import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, evaluateCoverage, fingerprint, instant, jobFingerprint, prepareJob, prepareWaiver, scopeHash, validateWaiverDraft } from '../src/domain.mjs';

const now = '2026-11-11T12:00:00.000Z';
export const draft = {
  id: 'permit-1', title: 'Cosmetic enclosure concession', sourceIssueKey: 'QA-1', projectKey: 'QA',
  supplier: 'Supplier A', part: 'ENC-40', revision: 'B', plant: 'Pune', lots: ['LOT-A', 'LOT-B'],
  unit: 'pieces', effectiveAt: '2026-11-11T10:00:00Z', expiresAt: '2026-11-12T10:00:00Z', quantityLimit: 500,
};
export const jobDraft = {
  id: 'job-QA-10', issueKey: 'QA-10', projectKey: 'QA', title: 'Fictional enclosure batch',
  supplier: 'Supplier A', part: 'ENC-40', revision: 'B', plant: 'Pune', lot: 'LOT-A', unit: 'pieces', quantity: 120,
};
function records() {
  const waiver = prepareWaiver(draft, { id: draft.id, actorId: 'owner', now });
  Object.assign(waiver, { status: 'approved', approvedBy: 'quality-owner', approvedAt: now, sourceFingerprint: 'source-v1', allocatedQuantity: 320 });
  const job = prepareJob(jobDraft, { id: jobDraft.id, actorId: 'operator', now });
  return { waiver, job };
}

test('canonical fingerprints ignore object key order and lot ordering, not identifier case', () => {
  assert.equal(canonicalJson({ z: 1, a: { c: 3, b: 2 } }), '{"a":{"b":2,"c":3},"z":1}');
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
  assert.equal(scopeHash(draft), scopeHash({ ...draft, lots: ['LOT-B', 'LOT-A'] }));
  assert.notEqual(scopeHash(draft), scopeHash({ ...draft, supplier: 'supplier a' }));
  for (const value of [NaN, Infinity, undefined, { missing: undefined }]) assert.throws(() => fingerprint(value), { code: 'INVALID_INPUT' });
});

test('invalid quantities, wildcard scope and ambiguous or impossible dates are rejected', () => {
  for (const value of [0, -1, 1.2, '500', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateWaiverDraft({ ...draft, quantityLimit: value }), { code: 'INVALID_INPUT' });
  for (const lots of [[], ['*'], ['LOT-A', 'LOT-A']]) assert.throws(() => validateWaiverDraft({ ...draft, lots }), { code: 'INVALID_INPUT' });
  for (const date of ['2026-11-11', '2026-11-11T12:00', '2026-02-30T10:00:00Z', '2026-13-01T00:00:00Z', '2026-11-11T24:00:00Z']) assert.throws(() => instant(date), { code: 'INVALID_INPUT' });
  assert.throws(() => validateWaiverDraft({ ...draft, expiresAt: draft.effectiveAt }), { code: 'INVALID_INPUT' });
});

test('effective time is inclusive, expiry exclusive and offsets resolve to the same instant', () => {
  const { waiver, job } = records();
  const options = { currentSourceFingerprint: 'source-v1' };
  assert.equal(evaluateCoverage(waiver, job, { ...options, now: waiver.effectiveAt }).status, 'covered');
  assert.equal(evaluateCoverage(waiver, job, { ...options, now: '2026-11-11T15:30:00+05:30' }).status, 'covered');
  assert.equal(evaluateCoverage(waiver, job, { ...options, now: waiver.expiresAt }).status, 'not-covered');
  assert.equal(evaluateCoverage(waiver, job, { ...options, now: '2026-11-11T09:59:59.999Z' }).status, 'not-covered');
});

test('each exact scope condition independently explains mismatch', () => {
  const { waiver, job } = records();
  for (const [key, value] of Object.entries({ supplier: 'supplier a', part: 'ENC-41', revision: 'C', plant: 'Mumbai', lot: 'LOT-C', unit: 'boxes', quantity: 181 })) {
    const result = evaluateCoverage(waiver, { ...job, [key]: value }, { now, currentSourceFingerprint: 'source-v1' });
    assert.equal(result.status, 'not-covered');
    assert.equal(result.checks.find((check) => check.key === key).status, 'fail');
  }
});

test('changed or unavailable source requires review and cannot yield covered', () => {
  const { waiver, job } = records();
  for (const source of ['source-v2', null, undefined, '']) {
    const result = evaluateCoverage(waiver, job, { now, currentSourceFingerprint: source });
    assert.equal(result.status, 'needs-review');
    assert.notEqual(result.checks.find((check) => check.key === 'source').status, 'pass');
  }
});

test('a permit does not cover a matching job in a different project', () => {
  const { waiver, job } = records();
  const result = evaluateCoverage(waiver, { ...job, projectKey: 'OTHER', issueKey: 'OTHER-1' }, { now, currentSourceFingerprint: 'source-v1' });
  assert.equal(result.status, 'not-covered');
  assert.equal(result.checks.find((check) => check.key === 'projectKey').status, 'fail');
});

test('edited scope cannot retain approval; forged stored hash is detected', () => {
  const { waiver, job } = records();
  waiver.allocatedQuantity = 0;
  const next = prepareWaiver({ ...waiver, lots: ['LOT-A'] }, { id: waiver.id, actorId: 'owner', now, existing: waiver });
  assert.equal(next.status, 'draft');
  assert.equal(next.approvedBy, null);
  assert.equal(next.sourceFingerprint, null);
  assert.equal(next.scopeVersion, waiver.scopeVersion + 1);
  assert.equal(next.allocatedQuantity, 0);
  const corrupted = { ...waiver, quantityLimit: 501 };
  assert.equal(evaluateCoverage(corrupted, job, { now, currentSourceFingerprint: 'source-v1' }).status, 'needs-review');
  waiver.allocatedQuantity = 320;
  for (const changes of [{ quantityLimit: 319 }, { unit: 'boxes' }, { lots: ['LOT-A'] }]) assert.throws(() => prepareWaiver({ ...waiver, ...changes }, { id: waiver.id, actorId: 'owner', now, existing: waiver }), { code: 'ACTIVE_ALLOCATIONS' });
  const titled = prepareWaiver({ ...waiver, title: 'Clearer title' }, { id: waiver.id, actorId: 'owner', now, existing: waiver });
  assert.equal(titled.status, 'approved');
  assert.equal(titled.allocatedQuantity, 320);
});

test('bookkeeping and title edits do not change job scope, quantity edits do', () => {
  const { job } = records();
  assert.equal(jobFingerprint(job), jobFingerprint({ ...job, version: 40, activeReservationId: 'r-1', title: 'A clearer title' }));
  assert.notEqual(jobFingerprint(job), jobFingerprint({ ...job, quantity: 121 }));
});
