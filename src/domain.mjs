import { createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  throw new DomainError('INVALID_INPUT', 'Only finite JSON values can be fingerprinted.');
}

export const fingerprint = (value) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export function text(value, label, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DomainError('INVALID_INPUT', `${label} must be a nonempty text value of at most ${max} characters.`);
  }
  return value.trim();
}

export function identifier(value, label = 'Identifier') {
  const result = text(value, label, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(result)) throw new DomainError('INVALID_INPUT', `${label} contains unsupported characters.`);
  return result;
}

export function quantity(value, label = 'Quantity', allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new DomainError('INVALID_INPUT', `${label} must be a ${allowZero ? 'nonnegative' : 'positive'} safe whole number.`);
  }
  return value;
}

export function instant(value, label = 'Date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new DomainError('INVALID_INPUT', `${label} must be an ISO date and time with an explicit timezone.`);
  }
  // Date.parse normalizes impossible calendar dates; reject those explicitly.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const [hour, minute] = value.slice(11, 16).split(':').map(Number);
  if (hour > 23 || minute > 59) throw new DomainError('INVALID_INPUT', `${label} is not a valid time.`);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    throw new DomainError('INVALID_INPUT', `${label} is not a valid calendar date.`);
  }
  return new Date(value).toISOString();
}

function jiraKey(value, label) {
  const key = text(value, label, 128);
  if (!/^[A-Z][A-Z0-9_]*-[1-9]\d*$/.test(key)) throw new DomainError('INVALID_INPUT', `${label} must be a Jira issue key.`);
  return key;
}

export const jobIdForIssue = (issueKey) => identifier(`job-${jiraKey(issueKey, 'Job issue')}`, 'Job ID');
export const sourceBindingIdForIssue = (issueKey) => identifier(`source-${jiraKey(issueKey, 'Source issue')}`, 'Source binding ID');

function projectKey(value) {
  const key = text(value, 'Project', 64);
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new DomainError('INVALID_INPUT', 'Project must be a Jira project key.');
  return key;
}

const scopeFields = ['sourceIssueKey', 'projectKey', 'supplier', 'part', 'revision', 'plant', 'lots', 'unit', 'effectiveAt', 'expiresAt', 'quantityLimit'];
const jobFields = ['id', 'issueKey', 'projectKey', 'supplier', 'part', 'revision', 'plant', 'lot', 'quantity', 'unit'];

export function validateWaiverDraft(input) {
  if (!input || typeof input !== 'object') throw new DomainError('INVALID_INPUT', 'A permit is required.');
  if (!Array.isArray(input.lots) || !input.lots.length || input.lots.length > 100) throw new DomainError('INVALID_INPUT', 'List between one and 100 exact lot identifiers.');
  const lots = input.lots.map((lot) => text(lot, 'Lot', 128));
  if (new Set(lots).size !== lots.length || lots.includes('*')) throw new DomainError('INVALID_INPUT', 'Lots must be unique exact identifiers, without wildcards.');
  const result = {
    title: text(input.title, 'Title', 200),
    sourceIssueKey: jiraKey(input.sourceIssueKey, 'Source issue'),
    projectKey: projectKey(input.projectKey),
    supplier: text(input.supplier, 'Supplier'), part: text(input.part, 'Part'),
    revision: text(input.revision, 'Part revision', 80), plant: text(input.plant, 'Plant'),
    lots: lots.sort(), unit: text(input.unit, 'Unit', 32),
    effectiveAt: instant(input.effectiveAt, 'Effective date'),
    expiresAt: instant(input.expiresAt, 'Expiry date'),
    quantityLimit: quantity(input.quantityLimit, 'Quantity limit'),
  };
  if (!result.sourceIssueKey.startsWith(`${result.projectKey}-`)) throw new DomainError('INVALID_INPUT', 'The source issue must belong to the selected project.');
  if (Date.parse(result.effectiveAt) >= Date.parse(result.expiresAt)) throw new DomainError('INVALID_INPUT', 'Expiry must follow the effective date.');
  for (const field of ['supplier', 'part', 'revision', 'plant', 'unit']) {
    if (result[field] === '*') throw new DomainError('INVALID_INPUT', 'Scope identifiers cannot be wildcards.');
  }
  return result;
}

export function validateJob(input) {
  if (!input || typeof input !== 'object') throw new DomainError('INVALID_INPUT', 'A job is required.');
  const result = {
    title: text(input.title, 'Title', 200), issueKey: jiraKey(input.issueKey, 'Job issue'),
    projectKey: projectKey(input.projectKey), supplier: text(input.supplier, 'Supplier'),
    part: text(input.part, 'Part'), revision: text(input.revision, 'Part revision', 80),
    plant: text(input.plant, 'Plant'), lot: text(input.lot, 'Lot', 128),
    quantity: quantity(input.quantity), unit: text(input.unit, 'Unit', 32),
  };
  if (!result.issueKey.startsWith(`${result.projectKey}-`)) throw new DomainError('INVALID_INPUT', 'The job issue must belong to the selected project.');
  for (const field of ['supplier', 'part', 'revision', 'plant', 'lot', 'unit']) {
    if (result[field] === '*') throw new DomainError('INVALID_INPUT', 'Job identifiers cannot be wildcards.');
  }
  return result;
}

export function scopeSnapshot(waiver) {
  const clean = validateWaiverDraft(waiver);
  return Object.fromEntries(scopeFields.map((key) => [key, clean[key]]));
}

export const scopeHash = (waiver) => fingerprint(scopeSnapshot(waiver));
export function jobSnapshot(job) {
  const clean = { ...validateJob(job), id: identifier(job.id, 'Job ID') };
  return Object.fromEntries(jobFields.map((key) => [key, clean[key]]));
}
export const jobFingerprint = (job) => fingerprint(jobSnapshot(job));

export function prepareWaiver(input, { id, actorId, now, existing = null }) {
  const clean = validateWaiverDraft(input);
  const at = instant(now, 'Current time');
  const allocated = existing ? quantity(existing.allocatedQuantity, 'Allocated quantity', true) : 0;
  if (existing && (clean.projectKey !== existing.projectKey || clean.sourceIssueKey !== existing.sourceIssueKey)) {
    throw new DomainError('SOURCE_IMMUTABLE', 'Create a new permit to use a different source issue or project.');
  }
  const newHash = scopeHash(clean);
  const changed = existing && newHash !== scopeHash(existing);
  if (changed && allocated > 0) throw new DomainError('ACTIVE_ALLOCATIONS', 'Cancel the active allocations before changing this permit’s scope, dates, unit or quantity limit. You can still edit its title.');
  if (clean.quantityLimit < allocated) throw new DomainError('BELOW_ALLOCATION', 'The quantity limit cannot be lower than existing allocations.');
  const result = {
    ...clean, id: identifier(id, 'Permit ID'), allocatedQuantity: allocated,
    version: existing ? existing.version + 1 : 1,
    scopeVersion: existing ? existing.scopeVersion + (changed ? 1 : 0) : 1,
    status: existing && !changed ? existing.status : 'draft', scopeHash: newHash,
    sourceFingerprint: existing && !changed ? existing.sourceFingerprint : null,
    approvedBy: existing && !changed ? existing.approvedBy : null,
    approvedAt: existing && !changed ? existing.approvedAt : null,
    createdBy: existing?.createdBy ?? text(actorId, 'Actor', 256),
    createdAt: existing?.createdAt ?? at, updatedAt: at,
  };
  if (existing?.revokedAt) result.previousRevocation = { at: existing.revokedAt, by: existing.revokedBy, reason: existing.revocationReason };
  if (existing?.status === 'revoked' && !changed) {
    result.revokedAt = existing.revokedAt;
    result.revokedBy = existing.revokedBy;
    result.revocationReason = existing.revocationReason;
  }
  return result;
}

export function prepareJob(input, { id, actorId, now, existing = null }) {
  const clean = validateJob(input);
  if (id !== jobIdForIssue(clean.issueKey)) throw new DomainError('INVALID_INPUT', 'The job ID must match its Jira issue.');
  if (existing && (clean.projectKey !== existing.projectKey || clean.issueKey !== existing.issueKey)) throw new DomainError('SOURCE_IMMUTABLE', 'Create a new job to use a different Jira issue or project.');
  return {
    ...clean, id: identifier(id, 'Job ID'), version: existing ? existing.version + 1 : 1,
    activeReservationId: existing?.activeReservationId ?? null,
    createdBy: existing?.createdBy ?? text(actorId, 'Actor', 256),
    createdAt: existing?.createdAt ?? instant(now), updatedAt: instant(now),
  };
}

export function evaluateCoverage(waiver, job, { now, currentSourceFingerprint, reservation = null } = {}) {
  const scope = scopeSnapshot(waiver);
  const jobView = jobSnapshot(job);
  const at = instant(now, 'Current time');
  const allocated = quantity(waiver.allocatedQuantity, 'Allocated quantity', true);
  if (allocated > scope.quantityLimit) throw new DomainError('CORRUPT_LEDGER', 'The recorded allocation exceeds the permit limit.');
  const available = scope.quantityLimit - allocated;
  const actualScopeHash = fingerprint(scope);
  const actualJobFingerprint = fingerprint(jobView);
  const ownReservation = reservation?.status === 'reserved' && reservation.waiverId === waiver.id && reservation.jobId === job.id;
  const availableForThisJob = available + (ownReservation ? reservation.quantity : 0);
  const checks = [];
  function check(key, label, matches, expected, actual, reason, unknown = false) {
    checks.push({ key, label, status: unknown ? 'unknown' : matches ? 'pass' : 'fail', expected, actual, reason });
  }
  check('approval', 'Human approval', waiver.status === 'approved' && Boolean(waiver.approvedBy && waiver.approvedAt), 'approved', waiver.status, waiver.status === 'revoked' ? 'The permit was revoked.' : 'The exact permit scope requires a recorded human approval.');
  check('scope-integrity', 'Approved scope', waiver.scopeHash === actualScopeHash, waiver.scopeHash ?? null, actualScopeHash, 'The current scope must match the approved scope fingerprint.');
  const sourceKnown = typeof currentSourceFingerprint === 'string' && currentSourceFingerprint.length > 0;
  check('source', 'Approval source', sourceKnown && waiver.sourceFingerprint === currentSourceFingerprint, waiver.sourceFingerprint ?? null, sourceKnown ? currentSourceFingerprint : null, sourceKnown ? 'The current source must match the source captured at approval.' : 'The approval source could not be verified; review is required.', !sourceKnown);
  check('effective', 'Effective date', Date.parse(at) >= Date.parse(scope.effectiveAt), scope.effectiveAt, at, 'The effective instant is inclusive.');
  check('expiry', 'Expiry date', Date.parse(at) < Date.parse(scope.expiresAt), scope.expiresAt, at, 'The permit stops applying at the expiry instant.');
  for (const [key, label] of [['projectKey', 'Project'], ['supplier', 'Supplier'], ['part', 'Part'], ['revision', 'Part revision'], ['plant', 'Plant'], ['unit', 'Unit']]) {
    check(key, label, scope[key] === jobView[key], scope[key], jobView[key], 'Identifiers must match exactly, including case.');
  }
  check('lot', 'Lot', scope.lots.includes(jobView.lot), scope.lots, jobView.lot, 'The lot must be explicitly listed in the permit.');
  check('quantity', 'Quantity allowance', jobView.quantity <= availableForThisJob, availableForThisJob, jobView.quantity, ownReservation ? 'This existing reservation is included in this job’s available allowance.' : 'Only the unallocated quantity can be reserved.');
  if (reservation) {
    check('reservation-status', 'Reservation state', reservation.status === 'reserved', 'reserved', reservation.status, 'A cancelled reservation is historical and does not reserve allowance.');
    check('job-snapshot', 'Reserved job', reservation.jobFingerprint === actualJobFingerprint, reservation.jobFingerprint, actualJobFingerprint, 'Editing the job does not rewrite its earlier reservation.');
    check('reservation-scope', 'Reserved approval', reservation.scopeHash === actualScopeHash && reservation.sourceFingerprint === waiver.sourceFingerprint, reservation.scopeHash, actualScopeHash, 'A reservation remains bound to its original approval scope and source.');
  }
  const reviewKeys = new Set(['scope-integrity', 'source', 'reservation-scope']);
  const failures = checks.filter((item) => item.status !== 'pass');
  const hardFailure = failures.some((item) => !reviewKeys.has(item.key) && !(item.key === 'approval' && waiver.status === 'draft'));
  const status = hardFailure ? 'not-covered' : failures.length ? 'needs-review' : 'covered';
  return {
    status, checks, available, availableForThisJob, requested: jobView.quantity,
    waiverVersion: waiver.version, scopeHash: actualScopeHash, jobFingerprint: actualJobFingerprint,
    sourceFingerprint: sourceKnown ? currentSourceFingerprint : null, checkedAt: at,
    summary: status === 'covered' ? 'This job fits the recorded approval and quantity allowance.' : status === 'needs-review' ? 'The approval context needs review before this job can be covered.' : 'This job is outside one or more recorded approval conditions.',
  };
}
