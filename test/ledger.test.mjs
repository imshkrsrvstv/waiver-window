import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerService } from '../src/ledger.mjs';
import { DomainError, prepareJob, prepareWaiver, sourceBindingIdForIssue } from '../src/domain.mjs';

const fixedTime = '2026-11-11T12:00:00.000Z';
const actor = { actorId: 'quality-owner' };
const waiverInput = {
  id: 'permit-1', title: 'Cosmetic enclosure concession', sourceIssueKey: 'QA-1', projectKey: 'QA',
  supplier: 'Supplier A', part: 'ENC-40', revision: 'B', plant: 'Pune', lots: ['LOT-A', 'LOT-B'],
  unit: 'pieces', effectiveAt: '2026-11-11T10:00:00Z', expiresAt: '2026-11-12T10:00:00Z', quantityLimit: 500,
};
const jobInput = (id, quantity = 120) => ({
  id, title: `Fictional ${id}`, issueKey: id === 'job-QA-10' ? 'QA-10' : 'QA-11', projectKey: 'QA',
  supplier: 'Supplier A', part: 'ENC-40', revision: 'B', plant: 'Pune', lot: 'LOT-A', unit: 'pieces', quantity,
});

class MemoryRepository {
  rows = new Map();
  beforeCommit = null;
  writes = 0;
  put(type, value) { this.rows.set(`${type}:${value.id}`, structuredClone(value)); }
  async get(type, id) { return structuredClone(this.rows.get(`${type}:${id}`) ?? null); }
  async compareAndSwapTransaction(transaction) {
    if (this.beforeCommit) await this.beforeCommit(transaction);
    // No await between checking and committing: one indivisible in-memory step.
    for (const condition of transaction.checks) {
      const current = this.rows.get(`${condition.type}:${condition.id}`);
      if (condition.version === null ? Boolean(current) : current?.version !== condition.version) return false;
    }
    for (const entry of transaction.writes) this.put(entry.type, entry.value);
    this.writes++;
    return true;
  }
  all(type) { return [...this.rows.entries()].filter(([key]) => key.startsWith(`${type}:`)).map(([, value]) => structuredClone(value)); }
}

function setup(overrides = {}) {
  const repository = new MemoryRepository();
  const waiver = prepareWaiver(waiverInput, { id: 'permit-1', actorId: actor.actorId, now: fixedTime });
  Object.assign(waiver, { status: 'approved', approvedBy: actor.actorId, approvedAt: fixedTime, sourceFingerprint: 'source-v1', allocatedQuantity: 320 });
  repository.put('waiver', waiver);
  repository.put('source-binding', { id: sourceBindingIdForIssue(waiver.sourceIssueKey), version: 1, projectKey: waiver.projectKey, sourceIssueKey: waiver.sourceIssueKey, waiverId: waiver.id, createdBy: actor.actorId, createdAt: fixedTime });
  for (const [id, amount] of [['job-QA-10', 120], ['job-QA-11', 100]]) repository.put('job', prepareJob(jobInput(id, amount), { id, actorId: actor.actorId, now: fixedTime }));
  const state = { source: 'source-v1', time: fixedTime, denied: false, actions: [] };
  const service = createLedgerService({
    repository, clock: () => state.time,
    authorize: async (request) => {
      state.actions.push(request);
      if (state.denied || request.actorId !== actor.actorId) throw new DomainError('FORBIDDEN', 'Not authorized.');
    },
    loadSourceFingerprint: async () => state.source,
    ...overrides,
  });
  return { repository, service, state, waiver };
}
const reserve = (service, jobId = 'job-QA-10', requestId = 'request-1') => service.reserve({ waiverId: 'permit-1', jobId, requestId }, actor);

test('concurrent 120 and 100 requests cannot overallocate 180 remaining units', async () => {
  const { service, repository } = setup();
  const outcomes = await Promise.allSettled([reserve(service), reserve(service, 'job-QA-11', 'request-2')]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.code, 'NOT_COVERED');
  const reservations = repository.all('reservation');
  const sum = reservations.reduce((total, item) => total + item.quantity, 0);
  const waiver = await repository.get('waiver', 'permit-1');
  assert.equal(waiver.allocatedQuantity, 320 + sum);
  assert.ok(waiver.allocatedQuantity <= 500);
  assert.equal(repository.all('audit').length, 1);
  assert.equal(repository.all('audit')[0].projectKey, 'QA');
});

test('simultaneous duplicate retries return one immutable receipt and consume once', async () => {
  const { service, repository } = setup();
  const outcomes = await Promise.all([reserve(service), reserve(service), reserve(service)]);
  assert.equal(new Set(outcomes.map((result) => result.reservation.id)).size, 1);
  assert.equal(outcomes.filter((result) => !result.idempotent).length, 1);
  assert.equal(repository.all('reservation').length, 1);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 440);
  const coverage = await service.checkCoverage({ waiverId: 'permit-1', jobId: 'job-QA-10' }, actor);
  assert.equal(coverage.status, 'covered');
  assert.equal(coverage.available, 60);
  assert.equal(coverage.availableForThisJob, 180);
});

test('a request ID cannot be reused for a different job or edited job scope', async () => {
  const { service } = setup();
  await reserve(service);
  await assert.rejects(reserve(service, 'job-QA-11'), { code: 'IDEMPOTENCY_CONFLICT' });
  await service.saveJob({ job: { ...jobInput('job-QA-10'), quantity: 119 }, expectedVersion: 2 }, actor);
  await assert.rejects(reserve(service), { code: 'IDEMPOTENCY_CONFLICT' });
});

test('one job cannot obtain multiple active reservations under new request IDs', async () => {
  const { service, repository } = setup();
  await reserve(service);
  await assert.rejects(reserve(service, 'job-QA-10', 'another-request'), { code: 'JOB_ALREADY_RESERVED' });
  assert.equal(repository.all('reservation').length, 1);
});

test('a duplicate Jira issue cannot be inserted under another application job ID', async () => {
  const { service, repository } = setup();
  await reserve(service);
  await assert.rejects(service.saveJob({ job: { ...jobInput('job-QA-10'), id: 'another-app-id' } }, actor), { code: 'INVALID_INPUT' });
  const { id: ignored, ...withoutId } = jobInput('job-QA-10');
  await assert.rejects(service.saveJob({ job: withoutId }, actor), { code: 'CONFLICT' });
  assert.equal(repository.all('job').filter((job) => job.issueKey === 'QA-10').length, 1);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 440);
});

test('scope changes are blocked while allocations remain, and cancellation enables a fresh draft', async () => {
  const { service, repository, waiver } = setup();
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  const { reservation } = await reserve(service);
  for (const changes of [{ unit: 'boxes' }, { part: 'OTHER' }, { quantityLimit: 1000 }]) {
    await assert.rejects(service.saveWaiver({ waiver: { ...waiverInput, ...changes }, expectedVersion: 2 }, actor), { code: 'ACTIVE_ALLOCATIONS' });
  }
  const titled = await service.saveWaiver({ waiver: { ...waiverInput, title: 'Clearer permit title' }, expectedVersion: 2 }, actor);
  assert.equal(titled.status, 'approved');
  assert.equal(titled.allocatedQuantity, 120);
  await service.cancelReservation({ id: reservation.id, reason: 'Prepare revised scope' }, actor);
  const current = await repository.get('waiver', 'permit-1');
  const edited = await service.saveWaiver({ waiver: { ...waiverInput, unit: 'boxes' }, expectedVersion: current.version }, actor);
  assert.equal(edited.status, 'draft');
  assert.equal(edited.allocatedQuantity, 0);
  assert.equal(edited.approvedBy, null);
});

test('concurrent cancellation restores allowance exactly once and preserves the original receipt', async () => {
  const { service, repository } = setup();
  const { reservation } = await reserve(service);
  const cancel = () => service.cancelReservation({ id: reservation.id, reason: 'Job no longer planned' }, actor);
  const results = await Promise.all([cancel(), cancel(), cancel()]);
  assert.equal(results.filter((result) => !result.idempotent).length, 1);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
  assert.equal((await repository.get('job', 'job-QA-10')).activeReservationId, null);
  const saved = await repository.get('reservation', reservation.id);
  assert.equal(saved.status, 'cancelled');
  assert.equal(saved.scopeHash, reservation.scopeHash);
  assert.equal(saved.jobFingerprint, reservation.jobFingerprint);
  assert.deepEqual(saved.scopeSnapshot, reservation.scopeSnapshot);
  assert.equal(repository.all('audit').length, 2);
  const retried = await reserve(service);
  assert.equal(retried.idempotent, true);
  assert.equal(retried.reservation.status, 'cancelled');
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
});

test('revocation winning a race prevents the pending reservation after CAS retry', async () => {
  const { service, repository } = setup();
  repository.beforeCommit = async (transaction) => {
    if (!transaction.writes.some((entry) => entry.type === 'reservation')) return;
    repository.beforeCommit = null;
    await service.revokeWaiver({ id: 'permit-1', expectedVersion: 1, reason: 'Supplier withdrew evidence' }, actor);
  };
  await assert.rejects(reserve(service), { code: 'NOT_COVERED' });
  assert.equal(repository.all('reservation').length, 0);
  assert.equal((await repository.get('waiver', 'permit-1')).status, 'revoked');
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
});

test('job edit winning a race is rechecked before any allocation', async () => {
  const { service, repository } = setup();
  repository.beforeCommit = async (transaction) => {
    if (!transaction.writes.some((entry) => entry.type === 'reservation')) return;
    repository.beforeCommit = null;
    await service.saveJob({ job: { ...jobInput('job-QA-10'), revision: 'C' }, expectedVersion: 1 }, actor);
  };
  await assert.rejects(reserve(service), { code: 'NOT_COVERED' });
  assert.equal(repository.all('reservation').length, 0);
});

test('changed or missing source, expired permit and out-of-scope job never allocate', async () => {
  for (const scenario of ['source-changed', 'source-missing', 'expired', 'wrong-lot']) {
    const { service, repository, state } = setup();
    if (scenario === 'source-changed') state.source = 'source-v2';
    if (scenario === 'source-missing') state.source = null;
    if (scenario === 'expired') state.time = waiverInput.expiresAt;
    if (scenario === 'wrong-lot') await service.saveJob({ job: { ...jobInput('job-QA-10'), lot: 'LOT-C' }, expectedVersion: 1 }, actor);
    await assert.rejects(reserve(service), { code: 'NOT_COVERED' });
    assert.equal(repository.all('reservation').length, 0);
    assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
  }
});

test('an edited reserved job preserves its receipt but no longer inherits coverage', async () => {
  const { service, repository } = setup();
  const { reservation } = await reserve(service);
  await service.saveJob({ job: { ...jobInput('job-QA-10'), revision: 'C' }, expectedVersion: 2 }, actor);
  const explanation = await service.explainReservation({ id: reservation.id }, actor);
  assert.equal(explanation.coverage.status, 'not-covered');
  assert.equal(explanation.coverage.checks.find((item) => item.key === 'job-snapshot').status, 'fail');
  assert.equal(explanation.reservation.jobSnapshot.revision, 'B');
  assert.equal(explanation.job.revision, 'C');
  await service.cancelReservation({ id: reservation.id, reason: 'Changed revision requires new review' }, actor);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
});

test('approved scope edits become drafts and stale expected versions cannot overwrite records', async () => {
  const { service, repository, waiver } = setup();
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  const next = await service.saveWaiver({ waiver: { ...waiverInput, quantityLimit: 600 }, expectedVersion: 1 }, actor);
  assert.equal(next.status, 'draft');
  assert.equal(next.approvedBy, null);
  await assert.rejects(reserve(service), { code: 'NOT_COVERED' });
  await assert.rejects(service.saveWaiver({ waiver: waiverInput, expectedVersion: 1 }, actor), { code: 'CONFLICT' });
  const approved = await service.approveWaiver({ id: next.id, expectedVersion: next.version, approvedBy: 'client-spoof' }, actor);
  assert.equal(approved.approvedBy, actor.actorId);
  assert.equal(approved.sourceFingerprint, 'source-v1');
});

test('authorization is checked for reads, writes, duplicate retry and cancellation', async () => {
  const { service, repository, state } = setup();
  const { reservation } = await reserve(service);
  state.denied = true;
  for (const operation of [
    () => reserve(service),
    () => service.checkCoverage({ waiverId: 'permit-1', jobId: 'job-QA-10' }, actor),
    () => service.explainReservation({ id: reservation.id }, actor),
    () => service.cancelReservation({ id: reservation.id, reason: 'Cancel' }, actor),
    () => service.saveJob({ job: jobInput('job-QA-10'), expectedVersion: 2 }, actor),
  ]) await assert.rejects(operation(), { code: 'FORBIDDEN' });
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 440);
  state.denied = false;
  await assert.rejects(service.reserve({ waiverId: 'permit-1', jobId: 'job-QA-11', requestId: 'fake', actorId: actor.actorId }, { actorId: 'unprivileged-user' }), { code: 'FORBIDDEN' });
});

test('storage conflicts are bounded and cannot write a partial receipt', async () => {
  const { repository } = setup();
  let attempts = 0;
  repository.compareAndSwapTransaction = async () => { attempts++; return false; };
  const service = createLedgerService({ repository, clock: () => fixedTime, authorize: async () => true, loadSourceFingerprint: async () => 'source-v1', maxAttempts: 3 });
  await assert.rejects(reserve(service), { code: 'CONFLICT' });
  assert.equal(attempts, 3);
  assert.equal(repository.all('reservation').length, 0);
  assert.equal(repository.all('audit').length, 0);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
});

test('untrusted approval and balance fields on a new draft are ignored', async () => {
  const { service } = setup();
  const created = await service.saveWaiver({ waiver: { ...waiverInput, id: 'new-permit', status: 'approved', approvedBy: 'client', allocatedQuantity: -1000 } }, actor);
  assert.equal(created.status, 'draft');
  assert.equal(created.allocatedQuantity, 0);
  assert.equal(created.approvedBy, null);
});

test('explicit source renewal records a new human approval and preserves cancelled historical receipts', async () => {
  const { service, repository, state, waiver } = setup();
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  const { reservation } = await reserve(service);
  state.source = 'source-v2';
  await assert.rejects(service.renewApproval({ id: waiver.id, expectedVersion: 2 }, actor), { code: 'ACTIVE_ALLOCATIONS' });
  await service.cancelReservation({ id: reservation.id, reason: 'Source changed; review before allocating again' }, actor);
  const before = await repository.get('waiver', waiver.id);
  const next = await service.renewApproval({ id: waiver.id, expectedVersion: before.version, sourceFingerprint: 'client-forged', approvedBy: 'client-forged' }, actor);
  assert.equal(next.sourceFingerprint, 'source-v2');
  assert.equal(next.approvedBy, actor.actorId);
  assert.equal(next.version, before.version + 1);
  assert.equal(next.scopeVersion, before.scopeVersion);
  assert.equal(next.scopeHash, before.scopeHash);
  assert.equal(next.allocatedQuantity, 0);
  assert.equal(state.actions.at(-1).action, 'renew-approval');
  const audit = repository.all('audit').find((event) => event.type === 'approval-renewed');
  assert.equal(audit.previousApproval.sourceFingerprint, 'source-v1');
  assert.equal(audit.sourceFingerprint, 'source-v2');
  assert.equal(audit.actorId, actor.actorId);
  const historical = await repository.get('reservation', reservation.id);
  assert.equal(historical.status, 'cancelled');
  assert.equal(historical.sourceFingerprint, 'source-v1');
  assert.equal((await service.checkCoverage({ waiverId: waiver.id, jobId: 'job-QA-10' }, actor)).status, 'covered');
});

test('renewal rejects unchanged, unavailable, expired, draft, revoked and unauthorized approvals', async () => {
  for (const scenario of ['unchanged', 'unavailable', 'expired', 'draft', 'revoked', 'unauthorized', 'stale-version', 'corrupt-scope']) {
    const { service, repository, state, waiver } = setup();
    repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
    state.source = scenario === 'unchanged' ? 'source-v1' : scenario === 'unavailable' ? null : 'source-v2';
    if (scenario === 'expired') state.time = waiver.expiresAt;
    if (['draft', 'revoked'].includes(scenario)) repository.put('waiver', { ...waiver, allocatedQuantity: 0, status: scenario });
    if (scenario === 'unauthorized') state.denied = true;
    if (scenario === 'corrupt-scope') repository.put('waiver', { ...waiver, allocatedQuantity: 0, scopeHash: 'corrupt' });
    const expected = { unchanged: 'SOURCE_UNCHANGED', unavailable: 'INVALID_INPUT', expired: 'EXPIRED', draft: 'INVALID_STATE', revoked: 'INVALID_STATE', unauthorized: 'FORBIDDEN', 'stale-version': 'CONFLICT', 'corrupt-scope': 'CORRUPT_LEDGER' }[scenario];
    await assert.rejects(service.renewApproval({ id: waiver.id, expectedVersion: scenario === 'stale-version' ? 0 : 1 }, actor), { code: expected });
    assert.equal(repository.all('audit').length, 0);
    assert.equal((await repository.get('waiver', waiver.id)).sourceFingerprint, 'source-v1');
  }
});

test('revocation winning the renewal race prevents renewed approval and its audit', async () => {
  const { service, repository, state, waiver } = setup();
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  state.source = 'source-v2';
  repository.beforeCommit = async (transaction) => {
    if (!transaction.writes.some((entry) => entry.value.type === 'approval-renewed')) return;
    repository.beforeCommit = null;
    await service.revokeWaiver({ id: waiver.id, expectedVersion: 1, reason: 'Evidence withdrawn during review' }, actor);
  };
  await assert.rejects(service.renewApproval({ id: waiver.id, expectedVersion: 1 }, actor), { code: 'CONFLICT' });
  assert.equal((await repository.get('waiver', waiver.id)).status, 'revoked');
  assert.equal(repository.all('audit').filter((event) => event.type === 'approval-renewed').length, 0);
});

test('a permit expiring during trusted source lookup cannot be renewed', async () => {
  let currentTime = fixedTime;
  const { service, repository, waiver } = setup({
    clock: () => currentTime,
    loadSourceFingerprint: async () => { currentTime = waiverInput.expiresAt; return 'source-v2'; },
  });
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  await assert.rejects(service.renewApproval({ id: waiver.id, expectedVersion: 1 }, actor), { code: 'EXPIRED' });
  assert.equal(repository.all('audit').length, 0);
});

test('competing drafts for one source can acquire only one approved allowance', async () => {
  const { service, repository } = setup();
  const draftInput = { ...waiverInput, id: undefined, sourceIssueKey: 'QA-2' };
  const drafts = await Promise.all([service.saveWaiver({ waiver: draftInput }, actor), service.saveWaiver({ waiver: draftInput }, actor)]);
  const results = await Promise.allSettled(drafts.map((draft) => service.approveWaiver({ id: draft.id, expectedVersion: draft.version }, actor)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'SOURCE_ALREADY_BOUND');
  const owner = results.find((result) => result.status === 'fulfilled').value;
  const binding = await repository.get('source-binding', sourceBindingIdForIssue('QA-2'));
  assert.equal(binding.waiverId, owner.id);
  assert.equal(binding.createdBy, actor.actorId);
  const rows = repository.all('waiver').filter((waiver) => waiver.sourceIssueKey === 'QA-2');
  assert.equal(rows.filter((waiver) => waiver.status === 'approved').length, 1);
  assert.equal(rows.filter((waiver) => waiver.status === 'approved').reduce((sum, waiver) => sum + waiver.quantityLimit, 0), 500);
  assert.equal(rows.find((waiver) => waiver.id !== owner.id).version, 1);
  assert.equal(repository.all('audit').filter((event) => event.type === 'waiver-approved' && drafts.some((waiver) => waiver.id === event.waiverId)).length, 1);
});

test('normal approval binds an existing draft without changing its identifier or scope', async () => {
  const { service, repository } = setup();
  const draft = await service.saveWaiver({ waiver: { ...waiverInput, id: 'existing-unapproved-draft', sourceIssueKey: 'QA-2' } }, actor);
  const approved = await service.approveWaiver({ id: draft.id, expectedVersion: draft.version }, actor);
  assert.equal(approved.id, draft.id);
  assert.equal(approved.scopeHash, draft.scopeHash);
  assert.equal(approved.quantityLimit, 500);
  assert.equal(approved.allocatedQuantity, 0);
  assert.equal((await repository.get('source-binding', sourceBindingIdForIssue('QA-2'))).waiverId, draft.id);
  assert.equal(repository.all('waiver').filter((waiver) => waiver.sourceIssueKey === 'QA-2').length, 1);
});

test('source ownership survives revocation and the same permit scope revision', async () => {
  const { service, repository, waiver } = setup();
  repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
  const originalBinding = await repository.get('source-binding', sourceBindingIdForIssue('QA-1'));
  const revoked = await service.revokeWaiver({ id: waiver.id, expectedVersion: 1, reason: 'Review required' }, actor);
  const alternative = await service.saveWaiver({ waiver: { ...waiverInput, id: 'alternative-draft' } }, actor);
  await assert.rejects(service.approveWaiver({ id: alternative.id, expectedVersion: alternative.version }, actor), { code: 'SOURCE_ALREADY_BOUND' });
  const revised = await service.saveWaiver({ waiver: { ...waiverInput, quantityLimit: 450 }, expectedVersion: revoked.version }, actor);
  assert.equal(revised.status, 'draft');
  const approved = await service.approveWaiver({ id: revised.id, expectedVersion: revised.version }, actor);
  assert.equal(approved.quantityLimit, 450);
  assert.deepEqual(await repository.get('source-binding', originalBinding.id), originalBinding);
});

test('missing, foreign or corrupt source ownership fails closed for approved records', async () => {
  for (const scenario of ['missing', 'foreign', 'corrupt']) {
    const { service, repository, waiver, state } = setup();
    repository.put('waiver', { ...waiver, allocatedQuantity: 0 });
    const id = sourceBindingIdForIssue('QA-1');
    if (scenario === 'missing') repository.rows.delete(`source-binding:${id}`);
    else {
      const binding = await repository.get('source-binding', id);
      repository.put('source-binding', { ...binding, ...(scenario === 'foreign' ? { waiverId: 'another-permit' } : { sourceIssueKey: 'QA-2' }) });
    }
    state.source = 'source-v2';
    const code = { missing: 'SOURCE_UNBOUND', foreign: 'SOURCE_ALREADY_BOUND', corrupt: 'CORRUPT_LEDGER' }[scenario];
    for (const operation of [
      () => service.checkCoverage({ waiverId: waiver.id, jobId: 'job-QA-10' }, actor),
      () => reserve(service),
      () => service.getRemaining({ waiverId: waiver.id }, actor),
      () => service.renewApproval({ id: waiver.id, expectedVersion: 1 }, actor),
    ]) await assert.rejects(operation(), { code });
    assert.equal(repository.all('reservation').length, 0);
    assert.equal(repository.all('audit').length, 0);
    assert.equal((await repository.get('waiver', waiver.id)).allocatedQuantity, 0);
  }
});

test('unauthorized and failed approvals cannot claim source ownership', async () => {
  for (const scenario of ['permission', 'storage']) {
    const { service, repository, state } = setup();
    const draft = await service.saveWaiver({ waiver: { ...waiverInput, id: 'unapproved', sourceIssueKey: 'QA-2' } }, actor);
    const before = repository.all('audit').length;
    if (scenario === 'permission') state.denied = true;
    else repository.beforeCommit = () => { throw new Error('Storage unavailable'); };
    await assert.rejects(service.approveWaiver({ id: draft.id, expectedVersion: 1 }, actor), scenario === 'permission' ? { code: 'FORBIDDEN' } : /Storage unavailable/);
    assert.equal(await repository.get('source-binding', sourceBindingIdForIssue('QA-2')), null);
    assert.equal((await repository.get('waiver', draft.id)).status, 'draft');
    assert.equal(repository.all('audit').length, before);
  }
});

test('different Jira sources retain independent allowance streams', async () => {
  const { service, repository } = setup();
  for (const sourceIssueKey of ['QA-2', 'QA-3']) {
    const draft = await service.saveWaiver({ waiver: { ...waiverInput, id: undefined, sourceIssueKey } }, actor);
    const approved = await service.approveWaiver({ id: draft.id, expectedVersion: 1 }, actor);
    assert.equal((await repository.get('source-binding', sourceBindingIdForIssue(sourceIssueKey))).waiverId, approved.id);
  }
  assert.equal(repository.all('source-binding').length, 3);
});

test('allocation checks its source binding in the atomic write boundary', async () => {
  const { service, repository } = setup();
  let interrupted = false;
  repository.beforeCommit = (transaction) => {
    if (interrupted || !transaction.writes.some((entry) => entry.type === 'reservation')) return;
    interrupted = true;
    assert(transaction.checks.some((entry) => entry.type === 'source-binding' && entry.version === 1));
    repository.rows.delete(`source-binding:${sourceBindingIdForIssue('QA-1')}`);
  };
  await assert.rejects(reserve(service), { code: 'SOURCE_UNBOUND' });
  assert.equal(repository.all('reservation').length, 0);
  assert.equal((await repository.get('waiver', 'permit-1')).allocatedQuantity, 320);
});

test('initial approval expiring during source lookup leaves no source claim', async () => {
  let time = fixedTime;
  const { service, repository } = setup({ clock: () => time, loadSourceFingerprint: async () => { time = waiverInput.expiresAt; return 'source-v1'; } });
  const draft = await service.saveWaiver({ waiver: { ...waiverInput, id: undefined, sourceIssueKey: 'QA-2' } }, actor);
  await assert.rejects(service.approveWaiver({ id: draft.id, expectedVersion: 1 }, actor), { code: 'EXPIRED' });
  assert.equal(await repository.get('source-binding', sourceBindingIdForIssue('QA-2')), null);
  assert.equal((await repository.get('waiver', draft.id)).status, 'draft');
});
