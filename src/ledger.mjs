import { randomUUID } from 'node:crypto';
import { DomainError, evaluateCoverage, fingerprint, identifier, instant, jobFingerprint, jobIdForIssue, jobSnapshot, prepareJob, prepareWaiver, quantity, scopeHash, scopeSnapshot, sourceBindingIdForIssue, text } from './domain.mjs';

/** Repository: get(type,id); compareAndSwapTransaction({checks,writes}) -> boolean.
 * Each check is {type,id,version}; null requires absence. Every write is
 * {type,id,value}. All conditions and writes must commit atomically.
 */
export function createLedgerService({ repository, authorize, loadSourceFingerprint, clock = () => new Date().toISOString(), ids = randomUUID, maxAttempts = 5 }) {
  if (!repository?.get || !repository?.compareAndSwapTransaction) throw new TypeError('An atomic repository is required.');
  if (typeof authorize !== 'function' || typeof loadSourceFingerprint !== 'function') throw new TypeError('Authorization and trusted source lookup are required.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new TypeError('Retries must be bounded between one and ten.');
  const now = () => instant(clock(), 'Current time');
  const actor = (context) => text(context?.actorId, 'Authenticated actor', 256);
  const get = async (type, id) => {
    const value = await repository.get(type, identifier(id));
    if (!value) throw new DomainError('NOT_FOUND', 'The requested record is unavailable.');
    return value;
  };
  const check = (type, value) => ({ type, id: value.id, version: value.version });
  const write = (type, value) => ({ type, id: value.id, value });
  const absent = (type, id) => ({ type, id, version: null });
  async function access(actorId, action, records) {
    const result = await authorize({ actorId, action, ...records });
    if (result === false) throw new DomainError('FORBIDDEN', 'You do not have permission to perform this action.');
  }
  function event(type, actorId, details, id = ids()) {
    return { id: identifier(id), version: 1, type, actorId, at: now(), ...details };
  }
  async function commit(checks, writes, audit) {
    return repository.compareAndSwapTransaction({ checks: [...checks, absent('audit', audit.id)], writes: [...writes, write('audit', audit)] });
  }
  function conflict() { throw new DomainError('CONFLICT', 'The records changed while this action was being completed. Refresh and try again.'); }
  function expectVersion(value, expectedVersion) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== value.version) conflict();
  }
  async function sourceBinding(waiver, { required = true } = {}) {
    const id = sourceBindingIdForIssue(waiver.sourceIssueKey);
    const binding = await repository.get('source-binding', id);
    if (!binding) {
      if (required) throw new DomainError('SOURCE_UNBOUND', 'This permit has no verified source binding and cannot be used. A project administrator must review the record.');
      return null;
    }
    if (binding.id !== id || binding.version !== 1 || binding.sourceIssueKey !== waiver.sourceIssueKey || binding.projectKey !== waiver.projectKey) {
      throw new DomainError('CORRUPT_LEDGER', 'The source binding does not match its linked Jira issue.');
    }
    if (binding.waiverId !== waiver.id) {
      throw new DomainError('SOURCE_ALREADY_BOUND', 'This Jira source already belongs to another approved permit. Use its existing allowance; another draft cannot create a second allowance.');
    }
    return binding;
  }
  async function coverageFor(waiver, job, actorId, reservation = null) {
    await access(actorId, 'read', { waiver, job, reservation });
    if (waiver.status === 'approved') await sourceBinding(waiver);
    const currentSourceFingerprint = await loadSourceFingerprint(waiver, { actorId });
    return evaluateCoverage(waiver, job, { now: now(), currentSourceFingerprint, reservation });
  }
  const service = {
    async saveWaiver({ waiver: input, expectedVersion }, context) {
      const actorId = actor(context);
      const id = input?.id ? identifier(input.id) : identifier(ids());
      const existing = await repository.get('waiver', id);
      if (existing) expectVersion(existing, expectedVersion);
      else if (expectedVersion !== undefined && expectedVersion !== null) conflict();
      const next = prepareWaiver(input, { id, actorId, now: now(), existing });
      await access(actorId, 'save-waiver', { waiver: existing ?? next, nextWaiver: next });
      const audit = event(existing ? 'waiver-edited' : 'waiver-created', actorId, { projectKey: next.projectKey, waiverId: id, scopeHash: next.scopeHash, scopeVersion: next.scopeVersion, previousVersion: existing?.version ?? null });
      if (!await commit([existing ? check('waiver', existing) : absent('waiver', id)], [write('waiver', next)], audit)) conflict();
      return next;
    },
    async approveWaiver({ id, expectedVersion }, context) {
      const actorId = actor(context);
      const waiver = await get('waiver', id);
      await access(actorId, 'approve-waiver', { waiver });
      expectVersion(waiver, expectedVersion);
      if (waiver.status !== 'draft') throw new DomainError('INVALID_STATE', 'Only a draft scope can be approved.');
      const existingBinding = await sourceBinding(waiver, { required: false });
      const at = now();
      if (Date.parse(waiver.expiresAt) <= Date.parse(at)) throw new DomainError('EXPIRED', 'An expired permit cannot be approved.');
      const source = text(await loadSourceFingerprint(waiver, { actorId }), 'Verified source fingerprint', 512);
      if (Date.parse(waiver.expiresAt) <= Date.parse(now())) throw new DomainError('EXPIRED', 'The permit expired while its source was being reviewed.');
      const next = { ...waiver, status: 'approved', scopeHash: scopeHash(waiver), sourceFingerprint: source, approvedBy: actorId, approvedAt: at, updatedAt: at, version: waiver.version + 1 };
      const audit = event('waiver-approved', actorId, { projectKey: next.projectKey, waiverId: id, scope: scopeSnapshot(next), scopeHash: next.scopeHash, sourceFingerprint: source, approvedVersion: next.version });
      const binding = existingBinding ?? {
        id: sourceBindingIdForIssue(waiver.sourceIssueKey), version: 1,
        sourceIssueKey: waiver.sourceIssueKey, projectKey: waiver.projectKey,
        waiverId: waiver.id, createdBy: actorId, createdAt: at,
      };
      // The immutable source claim and human approval share one transaction.
      // Competing drafts can never each acquire an independent allowance.
      const bindingCheck = existingBinding ? check('source-binding', binding) : absent('source-binding', binding.id);
      const bindingWrites = existingBinding ? [] : [write('source-binding', binding)];
      if (!await commit([check('waiver', waiver), bindingCheck], [write('waiver', next), ...bindingWrites], audit)) {
        await sourceBinding(waiver, { required: false });
        conflict();
      }
      return next;
    },
    async revokeWaiver({ id, expectedVersion, reason }, context) {
      const actorId = actor(context);
      const waiver = await get('waiver', id);
      await access(actorId, 'revoke-waiver', { waiver });
      expectVersion(waiver, expectedVersion);
      if (waiver.status !== 'approved') throw new DomainError('INVALID_STATE', 'Only an approved permit can be revoked.');
      const next = { ...waiver, status: 'revoked', version: waiver.version + 1, revokedBy: actorId, revokedAt: now(), revocationReason: text(reason, 'Revocation reason', 1200), updatedAt: now() };
      const audit = event('waiver-revoked', actorId, { projectKey: next.projectKey, waiverId: id, reason: next.revocationReason, previousVersion: waiver.version });
      if (!await commit([check('waiver', waiver)], [write('waiver', next)], audit)) conflict();
      return next;
    },
    async renewApproval({ id, expectedVersion }, context) {
      const actorId = actor(context);
      const waiver = await get('waiver', id);
      await access(actorId, 'renew-approval', { waiver });
      expectVersion(waiver, expectedVersion);
      if (waiver.status !== 'approved') throw new DomainError('INVALID_STATE', 'Only an approved permit with a changed source can be renewed. Revoked permits remain revoked.');
      const binding = await sourceBinding(waiver);
      if (quantity(waiver.allocatedQuantity, 'Allocated quantity', true) !== 0) throw new DomainError('ACTIVE_ALLOCATIONS', 'Cancel all active allocations before reviewing and renewing the changed source.');
      if (waiver.scopeHash !== scopeHash(waiver)) throw new DomainError('CORRUPT_LEDGER', 'The scope no longer matches its approval. Review this record before renewing.');
      if (Date.parse(waiver.expiresAt) <= Date.parse(now())) throw new DomainError('EXPIRED', 'An expired permit cannot be renewed. Create a revised draft with a new effective window.');
      const source = text(await loadSourceFingerprint(waiver, { actorId }), 'Verified source fingerprint', 512);
      if (source === waiver.sourceFingerprint) throw new DomainError('SOURCE_UNCHANGED', 'The recorded source is already current. A new approval is not needed.');
      const at = now();
      if (Date.parse(waiver.expiresAt) <= Date.parse(at)) throw new DomainError('EXPIRED', 'The permit expired while its source was being reviewed.');
      const next = { ...waiver, sourceFingerprint: source, approvedBy: actorId, approvedAt: at, updatedAt: at, version: waiver.version + 1 };
      const audit = event('approval-renewed', actorId, {
        projectKey: waiver.projectKey, waiverId: id, scope: scopeSnapshot(waiver), scopeHash: waiver.scopeHash,
        previousApproval: { actorId: waiver.approvedBy, at: waiver.approvedAt, sourceFingerprint: waiver.sourceFingerprint, version: waiver.version },
        sourceFingerprint: source, approvedVersion: next.version,
      });
      if (!await commit([check('waiver', waiver), check('source-binding', binding)], [write('waiver', next)], audit)) conflict();
      return next;
    },
    async saveJob({ job: input, expectedVersion }, context) {
      const actorId = actor(context);
      const id = jobIdForIssue(input?.issueKey);
      if (input?.id && input.id !== id) throw new DomainError('INVALID_INPUT', 'The job ID must match its Jira issue.');
      const existing = await repository.get('job', id);
      if (existing) expectVersion(existing, expectedVersion);
      else if (expectedVersion !== undefined && expectedVersion !== null) conflict();
      const next = prepareJob(input, { id, actorId, now: now(), existing });
      await access(actorId, 'save-job', { job: existing ?? next, nextJob: next });
      const audit = event(existing ? 'job-edited' : 'job-created', actorId, { projectKey: next.projectKey, jobId: id, jobFingerprint: jobFingerprint(next), previousVersion: existing?.version ?? null });
      if (!await commit([existing ? check('job', existing) : absent('job', id)], [write('job', next)], audit)) conflict();
      return next;
    },
    async checkCoverage({ waiverId, jobId }, context) {
      const actorId = actor(context);
      const [waiver, job] = await Promise.all([get('waiver', waiverId), get('job', jobId)]);
      const active = job.activeReservationId ? await repository.get('reservation', job.activeReservationId) : null;
      return coverageFor(waiver, job, actorId, active?.waiverId === waiver.id ? active : null);
    },
    async getRemaining({ waiverId }, context) {
      const actorId = actor(context);
      const waiver = await get('waiver', waiverId);
      await access(actorId, 'read', { waiver });
      if (waiver.status === 'approved') await sourceBinding(waiver);
      const source = await loadSourceFingerprint(waiver, { actorId });
      return {
        waiverId: waiver.id, title: waiver.title, projectKey: waiver.projectKey,
        quantityLimit: waiver.quantityLimit, allocatedQuantity: waiver.allocatedQuantity,
        remainingQuantity: waiver.quantityLimit - waiver.allocatedQuantity,
        unit: waiver.unit, status: waiver.status, sourceCurrent: source === waiver.sourceFingerprint,
        effectiveAt: waiver.effectiveAt, expiresAt: waiver.expiresAt, version: waiver.version,
        checkedAt: now(),
        meaning: 'App allocation only. Remaining quantity does not by itself authorize a job or physical shipment; check its complete coverage.',
      };
    },
    async reserve({ waiverId, jobId, requestId }, context) {
      const actorId = actor(context);
      identifier(waiverId); identifier(jobId); identifier(requestId, 'Request ID');
      const id = `r-${fingerprint({ waiverId, requestId })}`;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const [waiver, job, existing] = await Promise.all([get('waiver', waiverId), get('job', jobId), repository.get('reservation', id)]);
        await access(actorId, 'reserve', { waiver, job, reservation: existing });
        const requestFingerprint = fingerprint({ waiverId, jobId, jobFingerprint: jobFingerprint(job) });
        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request ID belongs to a different job or job revision.');
          return { reservation: existing, coverage: await coverageFor(waiver, job, actorId, existing), idempotent: true };
        }
        if (job.activeReservationId) throw new DomainError('JOB_ALREADY_RESERVED', 'This job already has an active reservation. Cancel it before allocating again.');
        const coverage = await coverageFor(waiver, job, actorId);
        if (coverage.status !== 'covered') throw new DomainError('NOT_COVERED', coverage.summary, coverage);
        const binding = await sourceBinding(waiver);
        const at = now();
        // Recheck time immediately before committing; expiry is never a scheduled-job dependency.
        if (Date.parse(at) >= Date.parse(waiver.expiresAt)) throw new DomainError('EXPIRED', 'The permit expired before the reservation could be committed.');
        const nextWaiver = { ...waiver, allocatedQuantity: quantity(waiver.allocatedQuantity + job.quantity, 'Allocated quantity'), version: waiver.version + 1, updatedAt: at };
        const reservation = {
          id, version: 1, projectKey: waiver.projectKey, waiverId, jobId, requestId, requestFingerprint,
          quantity: job.quantity, unit: job.unit, status: 'reserved',
          scopeHash: coverage.scopeHash, jobFingerprint: coverage.jobFingerprint,
          sourceFingerprint: coverage.sourceFingerprint, actorId, createdAt: at,
          cancelledAt: null, ledgerVersion: nextWaiver.version,
          scopeSnapshot: scopeSnapshot(waiver), jobSnapshot: jobSnapshot(job),
          approval: { actorId: waiver.approvedBy, at: waiver.approvedAt, scopeVersion: waiver.scopeVersion },
        };
        const nextJob = { ...job, activeReservationId: id, version: job.version + 1, updatedAt: at };
        const audit = event('quantity-reserved', actorId, { projectKey: waiver.projectKey, waiverId, jobId, reservationId: id, quantity: job.quantity, ledgerVersion: nextWaiver.version }, `a-${fingerprint({ action: 'reserve', id })}`);
        if (await commit([check('waiver', waiver), check('job', job), check('source-binding', binding), absent('reservation', id)], [write('waiver', nextWaiver), write('job', nextJob), write('reservation', reservation)], audit)) {
          return { reservation, coverage, idempotent: false };
        }
      }
      conflict();
    },
    async cancelReservation({ id, reason }, context) {
      const actorId = actor(context);
      const cancellationReason = text(reason, 'Cancellation reason', 1200);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const reservation = await get('reservation', id);
        const [waiver, job] = await Promise.all([get('waiver', reservation.waiverId), get('job', reservation.jobId)]);
        await access(actorId, 'cancel', { waiver, job, reservation });
        if (reservation.status === 'cancelled') return { reservation, idempotent: true };
        if (reservation.status !== 'reserved' || waiver.allocatedQuantity < reservation.quantity || job.activeReservationId !== reservation.id) throw new DomainError('CORRUPT_LEDGER', 'The reservation cannot be safely reconciled with the allocation ledger.');
        const at = now();
        const nextWaiver = { ...waiver, allocatedQuantity: waiver.allocatedQuantity - reservation.quantity, version: waiver.version + 1, updatedAt: at };
        const nextReservation = { ...reservation, version: reservation.version + 1, status: 'cancelled', cancelledAt: at, cancelledBy: actorId, cancellationReason, cancellationLedgerVersion: nextWaiver.version };
        const nextJob = { ...job, version: job.version + 1, activeReservationId: null, updatedAt: at };
        const audit = event('reservation-cancelled', actorId, { projectKey: waiver.projectKey, waiverId: waiver.id, jobId: job.id, reservationId: id, quantity: reservation.quantity, reason: cancellationReason }, `a-${fingerprint({ action: 'cancel', id })}`);
        if (await commit([check('waiver', waiver), check('job', job), check('reservation', reservation)], [write('waiver', nextWaiver), write('job', nextJob), write('reservation', nextReservation)], audit)) return { reservation: nextReservation, idempotent: false };
      }
      conflict();
    },
    async explainReservation({ id }, context) {
      const actorId = actor(context);
      const reservation = await get('reservation', id);
      const [waiver, job] = await Promise.all([get('waiver', reservation.waiverId), get('job', reservation.jobId)]);
      return { reservation, waiver, job, coverage: await coverageFor(waiver, job, actorId, reservation) };
    },
  };
  return service;
}
