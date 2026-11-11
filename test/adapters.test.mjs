import test from 'node:test';
import assert from 'node:assert/strict';
import { createForgeRepository } from '../src/forge-store.js';
import { createJiraAccess, trustedActor } from '../src/jira.js';
import { handler, checkCoverageTool, envelope } from '../src/index.js';
import { NeedsAuthenticationError } from '@forge/api';
import { createLedgerService } from '../src/ledger.mjs';

const at = '2026-11-11T08:00:00.000Z';
const record = (id, version = 1) => ({ id, version, projectKey: 'PACK', updatedAt: at });

test('platform consent challenges propagate while ordinary provider details stay private', async () => {
  const challenge = new NeedsAuthenticationError('Authentication Required', 'atlassian');
  await assert.rejects(envelope(async () => { throw challenge; }), (error) => error === challenge);
  const result = await envelope(async () => { throw new Error('private provider response'); });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(JSON.stringify(result).includes('private provider'), false);
});

function fakeStorage() {
  const rows = new Map();
  const batches = [];
  let failure;
  const storage = {
    entity() { return { get: async (key) => structuredClone(rows.get(key)) }; },
    transact() {
      const operations = [];
      const tx = {
        set(key, value, options) { operations.push({ key, value, options }); return tx; },
        check(key, options) { operations.push({ key, options }); return tx; },
        async execute() {
          batches.push(operations);
          if (failure) throw failure;
          for (const operation of operations) {
            const filter = operation.options.conditions.filters()[0];
            const existing = rows.get(operation.key);
            const valid = filter.condition === 'NOT_EXISTS' ? existing?.version === undefined : existing?.version === filter.values[0];
            if (!valid) throw new Error('Provider rejected condition');
          }
          for (const operation of operations) if (operation.value) rows.set(operation.key, structuredClone(operation.value));
        },
      };
      return tx;
    },
  };
  return { storage, rows, batches, fail(error) { failure = error; } };
}

test('Forge adapter creates records conditionally and merges checks onto each unique write', async () => {
  const { storage, batches } = fakeStorage();
  const repo = createForgeRepository(storage);
  assert.equal(await repo.compareAndSwapTransaction({ checks: [{ type: 'waiver', id: 'w1', version: null }], writes: [{ type: 'waiver', id: 'w1', value: record('w1') }] }), true);
  assert.deepEqual(await repo.get('waiver', 'w1'), record('w1'));
  assert.equal(batches[0].length, 1);
  assert.equal(batches[0][0].options.conditions.filters()[0].condition, 'NOT_EXISTS');
  assert.equal(await repo.compareAndSwapTransaction({ checks: [{ type: 'waiver', id: 'w1', version: 1 }], writes: [{ type: 'waiver', id: 'w1', value: record('w1', 2) }] }), true);
  assert.equal(batches[1][0].options.conditions.filters()[0].condition, 'EQUAL_TO');
});

test('Forge adapter detects a real conflicting revision without writing a partial receipt', async () => {
  const { storage, rows } = fakeStorage();
  const repo = createForgeRepository(storage);
  rows.set('waiver#w1', { kind: 'waiver', version: 3, record: record('w1', 3) });
  const result = await repo.compareAndSwapTransaction({
    checks: [{ type: 'waiver', id: 'w1', version: 2 }, { type: 'reservation', id: 'r1', version: null }],
    writes: [{ type: 'waiver', id: 'w1', value: record('w1', 3) }, { type: 'reservation', id: 'r1', value: record('r1') }],
  });
  assert.equal(result, false);
  assert.equal(await repo.get('reservation', 'r1'), null);
});

test('Forge adapter preserves storage failures when no version conflict is proven', async () => {
  const mock = fakeStorage();
  const repo = createForgeRepository(mock.storage);
  const failure = new Error('Temporary outage');
  mock.fail(failure);
  await assert.rejects(repo.compareAndSwapTransaction({ checks: [{ type: 'job', id: 'j1', version: null }], writes: [{ type: 'job', id: 'j1', value: record('j1') }] }), (error) => error === failure);
});

test('Forge adapter refuses unchecked writes, repeated keys and corrupt metadata', async () => {
  const { storage, rows } = fakeStorage();
  const repo = createForgeRepository(storage);
  await assert.rejects(repo.compareAndSwapTransaction({ checks: [], writes: [{ type: 'job', id: 'j1', value: record('j1') }] }), /explicit version/);
  await assert.rejects(repo.compareAndSwapTransaction({ checks: [{ type: 'job', id: 'j1', version: null }, { type: 'job', id: 'j1', version: null }], writes: [] }), /write set/);
  rows.set('job#j1', { kind: 'job', version: 2, record: record('j1', 1) });
  await assert.rejects(repo.get('job', 'j1'), { code: 'CORRUPT_LEDGER' });
});

function fakeJira({ admin = false, edit = true, status = 200 } = {}) {
  const requests = [];
  const issue = { id: '10001', key: 'PACK-1', fields: { project: { key: 'PACK' }, summary: 'Fictional cosmetic packaging deviation', updated: at, description: null, status: { id: '1' }, labels: [], attachment: [] } };
  return {
    requests, issue,
    client: {
      asApp() { throw new Error('asApp must never be called'); },
      asUser() {
        return { async requestJira(path) {
          requests.push(path.value);
          const permission = path.value.includes('/mypermissions?');
          return { status, ok: status === 200, json: async () => permission ? { permissions: { BROWSE_PROJECTS: { havePermission: true }, EDIT_ISSUES: { havePermission: edit }, ADMINISTER_PROJECTS: { havePermission: admin } } } : structuredClone(issue) };
        } };
      },
    },
  };
}
const waiver = { id: 'w1', projectKey: 'PACK', sourceIssueKey: 'PACK-1' };
const job = { id: 'job-PACK-1', projectKey: 'PACK', issueKey: 'PACK-1' };

test('approval verifies project administrator permission from Jira, not client claims', async () => {
  const mock = fakeJira();
  const jira = createJiraAccess({ actorId: 'trusted-user', client: mock.client });
  await assert.rejects(jira.authorize({ actorId: 'trusted-user', action: 'approve-waiver', waiver: { ...waiver, canApprove: true } }), { code: 'FORBIDDEN' });
  await assert.rejects(jira.authorize({ actorId: 'trusted-user', action: 'renew-approval', waiver: { ...waiver, canApprove: true } }), { code: 'FORBIDDEN' });
  assert.match(mock.requests.at(-1), /projectKey=PACK/);
  assert.match(mock.requests.at(-1), /ADMINISTER_PROJECTS/);
  const admin = createJiraAccess({ actorId: 'trusted-user', client: fakeJira({ admin: true }).client });
  assert.equal(await admin.authorize({ actorId: 'trusted-user', action: 'approve-waiver', waiver }), true);
});

test('Jira adapter rejects actor spoofing, inaccessible issues, moved project and unauthorized reservation', async () => {
  const mock = fakeJira({ edit: false });
  const jira = createJiraAccess({ actorId: 'trusted-user', client: mock.client });
  await assert.rejects(jira.authorize({ actorId: 'model-supplied-user', action: 'read', waiver }), { code: 'FORBIDDEN' });
  assert.equal(mock.requests.length, 0);
  await assert.rejects(jira.authorize({ actorId: 'trusted-user', action: 'reserve', waiver, job }), { code: 'FORBIDDEN' });
  mock.issue.fields.project.key = 'OTHER';
  await assert.rejects(jira.authorize({ actorId: 'trusted-user', action: 'read', waiver }), { code: 'PROJECT_MISMATCH' });
  const denied = createJiraAccess({ actorId: 'trusted-user', client: fakeJira({ status: 404 }).client });
  await assert.rejects(denied.authorize({ actorId: 'trusted-user', action: 'read', waiver }), { code: 'FORBIDDEN' });
});

test('source fingerprint is refreshed and changes when the real issue or attachment metadata changes', async () => {
  const mock = fakeJira();
  const jira = createJiraAccess({ actorId: 'trusted-user', client: mock.client });
  const first = await jira.loadSourceFingerprint(waiver, { actorId: 'trusted-user' });
  mock.issue.fields.attachment = [{ id: '202', filename: 'qualification.txt', size: 120, created: at }];
  const second = await jira.loadSourceFingerprint(waiver, { actorId: 'trusted-user' });
  assert.notEqual(first, second);
  assert.equal(mock.requests.length, 2);
});

test('resolver and MCP ignore payload identity; no trusted runtime principal means no access', async () => {
  assert.throws(() => trustedActor({ payload: { accountId: 'forged' } }), { code: 'AUTH_REQUIRED' });
  const result = await handler({ call: { functionKey: 'bootstrap', payload: { accountId: 'forged', projectKey: 'PACK' } }, context: { accountId: 'forged', principal: { accountId: 'also-forged' } } }, {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'AUTH_REQUIRED');
  const mcp = await checkCoverageTool({ waiverId: 'w1', jobId: 'j1', accountId: 'forged', context: { accountId: 'forged' } }, {});
  assert.equal(mcp.error.code, 'AUTH_REQUIRED');
  assert.equal(trustedActor({ principal: { accountId: 'runtime-user' } }), 'runtime-user');
});

test('source claim uses real Jira approval authorization and the Forge conditional transaction adapter', async () => {
  const mock = fakeStorage();
  const repository = createForgeRepository(mock.storage);
  const makeService = (admin) => {
    const jira = createJiraAccess({ actorId: 'trusted-user', client: fakeJira({ admin }).client });
    return createLedgerService({ repository, authorize: jira.authorize, loadSourceFingerprint: jira.loadSourceFingerprint, clock: () => at });
  };
  const actor = { actorId: 'trusted-user' };
  const draft = await makeService(false).saveWaiver({ waiver: {
    title: 'Fictional test', projectKey: 'PACK', sourceIssueKey: 'PACK-1', supplier: 'Supplier',
    part: 'PART-1', revision: 'A', plant: 'Pune', lots: ['LOT-A'], unit: 'pieces', quantityLimit: 500,
    effectiveAt: '2026-11-11T07:00:00Z', expiresAt: '2026-11-12T07:00:00Z',
  } }, actor);
  await assert.rejects(makeService(false).approveWaiver({ id: draft.id, expectedVersion: 1, canApprove: true }, actor), { code: 'FORBIDDEN' });
  assert.equal(await repository.get('source-binding', 'source-PACK-1'), null);
  assert.equal(mock.batches.length, 1);
  const approved = await makeService(true).approveWaiver({ id: draft.id, expectedVersion: 1 }, actor);
  assert.equal(approved.id, draft.id);
  const batch = mock.batches.at(-1);
  assert.equal(batch.length, 3);
  assert.equal(batch.find((operation) => operation.key === 'source-binding#source-PACK-1').options.conditions.filters()[0].condition, 'NOT_EXISTS');
  assert.equal((await repository.get('source-binding', 'source-PACK-1')).waiverId, draft.id);
});
