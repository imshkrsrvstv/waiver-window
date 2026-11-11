import ResolverModule from '@forge/resolver';
import { NeedsAuthenticationError } from '@forge/api';
import { DomainError } from './domain.mjs';
import { createLedgerService } from './ledger.mjs';
import { createForgeRepository } from './forge-store.js';
import { createJiraAccess, trustedActor } from './jira.js';

const Resolver = ResolverModule.default ?? ResolverModule;
const resolver = new Resolver();
const serviceMethods = ['saveWaiver', 'approveWaiver', 'renewApproval', 'revokeWaiver', 'saveJob', 'checkCoverage', 'reserve', 'cancelReservation', 'explainReservation'];

function invocation(context, { runtime = false } = {}) {
  // Resolver.accountId is overwritten by @forge/resolver from the backend
  // principal. Other properties of its merged UI context are not identities.
  // Direct action handlers receive the trusted runtime context as argument two.
  const actorId = trustedActor(runtime ? context : { accountId: context?.accountId });
  const repository = createForgeRepository();
  const jira = createJiraAccess({ actorId });
  const service = createLedgerService({ repository, authorize: jira.authorize, loadSourceFingerprint: jira.loadSourceFingerprint });
  return { actorId, repository, jira, service };
}

export async function envelope(operation) {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    // Forge must receive its own challenge to open the platform consent flow.
    // Swallowing it would leave a first-time user unable to grant access.
    if (error instanceof NeedsAuthenticationError || error?.name === 'NEEDS_AUTHENTICATION_ERR') throw error;
    // Provider bodies and issue contents never enter client errors or logs.
    if (error instanceof DomainError) return { ok: false, error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } };
    return { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'The request could not be verified or saved. Refresh and try again; no success has been confirmed.' } };
  }
}

async function boundedMap(items, operation, concurrency = 5) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await operation(items[index]);
    }
  }));
  return output;
}

resolver.define('bootstrap', ({ payload, context }) => envelope(async () => {
  const { actorId, repository, jira } = invocation(context);
  const projectKey = await jira.resolveProject(payload, context);
  const grants = await jira.permissions(projectKey);
  if (!grants.BROWSE_PROJECTS) throw new DomainError('FORBIDDEN', 'Jira project access is required.');
  const [waiverPage, jobPage, reservationPage] = await Promise.all([
    repository.list('waiver', projectKey, { limit: 40 }),
    repository.list('job', projectKey, { limit: 40 }),
    repository.list('reservation', projectKey, { limit: 40 }),
  ]);
  async function visible(record, type) {
    try {
      if (type === 'reservation') {
        const [waiver, job] = await Promise.all([repository.get('waiver', record.waiverId), repository.get('job', record.jobId)]);
        if (!waiver || !job) return null;
        await jira.authorize({ actorId, action: 'read', waiver, job, reservation: record });
      } else await jira.authorize({ actorId, action: 'read', [type]: record });
      return record;
    } catch (error) {
      if (error instanceof DomainError && ['FORBIDDEN', 'PROJECT_MISMATCH', 'SOURCE_MOVED'].includes(error.code)) return null;
      throw error;
    }
  }
  const [waivers, jobs, reservations] = await Promise.all([
    boundedMap(waiverPage.records, (record) => visible(record, 'waiver')),
    boundedMap(jobPage.records, (record) => visible(record, 'job')),
    boundedMap(reservationPage.records, (record) => visible(record, 'reservation')),
  ]);
  return {
    user: { accountId: actorId, canApprove: grants.ADMINISTER_PROJECTS },
    projectKey, waivers: waivers.filter(Boolean), jobs: jobs.filter(Boolean), reservations: reservations.filter(Boolean),
    mode: 'forge',
    discovery: { limitPerType: 40, truncated: Boolean(waiverPage.nextCursor || jobPage.nextCursor || reservationPage.nextCursor), consistency: 'eventual' },
  };
}));

for (const name of serviceMethods) {
  resolver.define(name, ({ payload, context }) => envelope(async () => {
    const { actorId, service } = invocation(context);
    return service[name](payload ?? {}, { actorId });
  }));
}

export const handler = resolver.getDefinitions();

export const checkCoverageTool = (payload, context) => envelope(async () => {
  const { actorId, service } = invocation(context, { runtime: true });
  return service.checkCoverage({ waiverId: payload?.waiverId, jobId: payload?.jobId }, { actorId });
});

export const explainReservationTool = (payload, context) => envelope(async () => {
  const { actorId, service } = invocation(context, { runtime: true });
  return service.explainReservation({ id: payload?.id }, { actorId });
});

export const getRemainingTool = (payload, context) => envelope(async () => {
  const { actorId, service } = invocation(context, { runtime: true });
  return service.getRemaining({ waiverId: payload?.waiverId }, { actorId });
});
