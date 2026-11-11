import api, { route } from '@forge/api';
import { DomainError, fingerprint, text } from './domain.mjs';

const HEADERS = { Accept: 'application/json' };

function projectKey(value) {
  const key = text(value, 'Project', 64);
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new DomainError('INVALID_INPUT', 'A valid Jira project key is required.');
  return key;
}
function issueKey(value) {
  const key = text(value, 'Issue', 128);
  if (!/^[A-Z][A-Z0-9_]*-[1-9]\d*$/.test(key)) throw new DomainError('INVALID_INPUT', 'A valid Jira issue key is required.');
  return key;
}

export function trustedActor(context) {
  const accountId = context?.accountId ?? context?.principal?.accountId;
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new DomainError('AUTH_REQUIRED', 'Open this app as a signed-in Jira user.');
  }
  return text(accountId, 'Authenticated actor', 256);
}

/** Construct per invocation. No cross-user permission cache and no asApp calls. */
export function createJiraAccess({ actorId, client = api }) {
  const expectedActor = text(actorId, 'Authenticated actor', 256);
  function assertActor(candidate) {
    if (candidate !== expectedActor) throw new DomainError('FORBIDDEN', 'The authenticated actor does not match this request.');
  }
  async function read(path) {
    const response = await client.asUser().requestJira(path, { headers: HEADERS });
    if ([401, 403, 404].includes(response.status)) throw new DomainError('FORBIDDEN', 'A required Jira record is unavailable to this user.');
    if (!response.ok) throw new DomainError('JIRA_UNAVAILABLE', 'Jira could not verify this request. Try again shortly.');
    return response.json();
  }
  async function loadIssue(key, expectedProject) {
    const cleanKey = issueKey(key);
    const fields = 'project,summary,description,status,updated,attachment,labels';
    const issue = await read(route`/rest/api/3/issue/${cleanKey}?fields=${fields}`);
    if (!issue.id || !issue.key || !issue.fields?.project?.key) throw new DomainError('JIRA_UNAVAILABLE', 'Jira returned an incomplete issue.');
    if (expectedProject && issue.fields.project.key !== projectKey(expectedProject)) {
      throw new DomainError('PROJECT_MISMATCH', 'The Jira issue does not belong to this project.');
    }
    // A renamed/moved key must be deliberately rebound in a new app record.
    if (issue.key !== cleanKey) throw new DomainError('SOURCE_MOVED', 'This Jira issue has moved or changed key. Review its linked app record.');
    return issue;
  }
  async function permissions(project, issue) {
    const names = 'BROWSE_PROJECTS,EDIT_ISSUES,ADMINISTER_PROJECTS';
    const data = issue
      ? await read(route`/rest/api/3/mypermissions?issueKey=${issueKey(issue)}&permissions=${names}`)
      : await read(route`/rest/api/3/mypermissions?projectKey=${projectKey(project)}&permissions=${names}`);
    return Object.fromEntries(names.split(',').map((name) => [name, data.permissions?.[name]?.havePermission === true]));
  }
  async function requireEdit(record, source = false) {
    const key = source ? record.sourceIssueKey : record.issueKey;
    const grants = await permissions(record.projectKey, key);
    if (!grants.EDIT_ISSUES) throw new DomainError('FORBIDDEN', 'Editing the linked Jira issue is required for this action.');
  }
  async function requireApproval(project) {
    const grants = await permissions(project);
    if (!grants.ADMINISTER_PROJECTS) throw new DomainError('FORBIDDEN', 'A Jira project administrator must approve or revoke this permit.');
  }
  async function authorize({ actorId: candidate, action, waiver, nextWaiver, job, nextJob, reservation }) {
    assertActor(candidate);
    const waivers = [waiver, nextWaiver].filter(Boolean);
    const jobs = [job, nextJob].filter(Boolean);
    const records = [...waivers, ...jobs, reservation].filter(Boolean);
    if (!records.length) throw new DomainError('FORBIDDEN', 'A linked record is required.');
    if (new Set(records.map((record) => record.projectKey)).size !== 1) throw new DomainError('PROJECT_MISMATCH', 'All records must belong to the same Jira project.');
    if (reservation && ((waiver && reservation.waiverId !== waiver.id) || (job && reservation.jobId !== job.id))) {
      throw new DomainError('CORRUPT_LEDGER', 'The reservation does not match its related records.');
    }
    const links = new Map();
    for (const item of waivers) links.set(item.sourceIssueKey, item.projectKey);
    for (const item of jobs) links.set(item.issueKey, item.projectKey);
    if (!links.size) throw new DomainError('FORBIDDEN', 'Related Jira records are required.');
    await Promise.all([...links].map(([key, project]) => loadIssue(key, project)));
    switch (action) {
      case 'read': return true;
      case 'save-waiver': await requireEdit(nextWaiver ?? waiver, true); return true;
      case 'save-job': await requireEdit(nextJob ?? job); return true;
      case 'approve-waiver':
      case 'renew-approval':
      case 'revoke-waiver': await requireApproval(waiver.projectKey); return true;
      case 'reserve': await requireEdit(job); return true;
      case 'cancel':
        await requireEdit(job);
        if (reservation.actorId !== expectedActor) await requireApproval(waiver.projectKey);
        return true;
      default: throw new DomainError('FORBIDDEN', 'This action is not allowed.');
    }
  }
  async function loadSourceFingerprint(waiver, { actorId: candidate }) {
    assertActor(candidate);
    const issue = await loadIssue(waiver.sourceIssueKey, waiver.projectKey);
    const fields = issue.fields;
    // This is a Jira issue snapshot hash, not a hash of attachment file bytes.
    // Any issue update invalidates the approval conservatively. It is refreshed
    // on every check; event delivery is not an authorization dependency.
    return fingerprint({
      issueId: issue.id,
      issueKey: issue.key,
      projectKey: fields.project.key,
      updated: fields.updated ?? null,
      summary: fields.summary ?? null,
      description: fields.description ?? null,
      statusId: fields.status?.id ?? null,
      labels: [...(fields.labels ?? [])].sort(),
      attachments: (fields.attachment ?? []).map((file) => ({ id: file.id, filename: file.filename, size: file.size, created: file.created })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    });
  }
  async function resolveProject(payload, context) {
    const selected = payload?.projectKey ?? context?.extension?.project?.key ?? context?.extension?.projectKey;
    if (selected) {
      const key = projectKey(selected);
      const project = await read(route`/rest/api/3/project/${key}`);
      if (project.key !== key) throw new DomainError('PROJECT_MISMATCH', 'The project key changed. Reopen the current Jira project.');
      return key;
    }
    const currentIssue = context?.extension?.issue?.key;
    if (currentIssue) return (await loadIssue(currentIssue)).fields.project.key;
    throw new DomainError('PROJECT_REQUIRED', 'Open Waiver Window from a Jira project or issue.');
  }
  return { authorize, loadSourceFingerprint, loadIssue, permissions, resolveProject };
}
