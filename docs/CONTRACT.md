# Waiver Window MVP contract

One focused Codegeist project for Specialized Industries, with read-only Atlassian MCP tools. Product identity: an industrial approval desk in porcelain, ink and oxidized copper, with amber finite-allowance marks. Complete light and dark themes. The allocation ruler and scoped permit explain whether a job fits an existing approval. The app is a review aid, not physical shipment authorization.

## Data

**Waiver:** `id`, `title`, `sourceIssueKey`, `projectKey`, `supplier`, `part`, `revision`, `plant`, `lots:string[]`, `unit`, `effectiveAt`, `expiresAt`, `quantityLimit`, `allocatedQuantity`, `version`, `scopeVersion`, `status` (`draft`, `approved`, `revoked`), `scopeHash`, `sourceFingerprint`, `approvedBy`, `approvedAt`, and creation/update fields. Revocation adds `revokedBy`, `revokedAt`, and `revocationReason`.

**Job:** `id`, `issueKey`, `projectKey`, `title`, `supplier`, `part`, `revision`, `plant`, `lot`, `quantity`, `unit`, `version`, `activeReservationId`, and creation/update fields. The canonical ID is `job-` plus the exact validated Jira issue key. The server derives it; another app ID cannot duplicate the same Jira issue.

**Reservation:** `id`, `version`, `projectKey`, `waiverId`, `jobId`, `requestId`, `requestFingerprint`, `quantity`, `unit`, `status` (`reserved`, `cancelled`), `scopeHash`, `jobFingerprint`, `sourceFingerprint`, `actorId`, `createdAt`, `cancelledAt`, `ledgerVersion`, immutable scope/job snapshots and approval provenance. Cancellation adds its actor, reason, time and ledger version; original snapshots remain intact.

Quantities are positive safe whole numbers; allocated quantity may be zero. Scope identifiers match exactly, with no blank or wildcard scope. Waiver and job must belong to the same Jira project. Allocation is app bookkeeping, not physical inventory or fulfillment.

Scope changes require zero allocations and return the permit to draft. Title-only changes preserve its approval and balance. Source issue/project links cannot be silently reassigned. Editing a reserved job changes its current coverage without rewriting the old receipt. One canonical job has at most one active reservation; duplicate requests consume once and cancellation restores once.

Source changes require explicit human review. Renewal is permitted only for an approved, unexpired record with zero allocations, an unchanged exact scope, a different verified source fingerprint and the expected record version. It writes a new human approval and audit event. Revoked permits remain revoked. Approval, renewal and revocation require the actual Jira project-administrator permission; client-supplied actors and approval fields are ignored.

## One allowance stream per source

Within each installation, alternative drafts may refer to the same exact Jira source issue. The first explicit approval atomically creates an immutable `source-binding` record and approves its owning permit. The binding key is `source-` plus the validated source issue key; fields are `id`, `version:1`, `projectKey`, `sourceIssueKey`, `waiverId`, `createdBy` and `createdAt`. The existing permit ID and entered scope are preserved.

Only that permit may hold an approved allowance for the source. A competing approval returns `SOURCE_ALREADY_BOUND` without a partial approval, binding or audit write. Revocation, expiry and scope edits do not release or transfer ownership. The same permit can undergo the documented explicit scope revision/reapproval workflow; an independent approval stream needs a different source issue. Draft creation alone never reserves source ownership.

Approved coverage, remaining-allowance tools and receipt checks verify the binding; allocation and renewal also condition their transaction on it. An older approved record with no binding fails closed with `SOURCE_UNBOUND`; corrupt metadata fails with `CORRUPT_LEDGER`. No query-based inference, silent backfill, source transfer or deletion path exists. Unapproved existing drafts acquire their binding through normal human approval. Cancellation/revocation remain available to safely stop an existing record; neither frees the source for a competing permit.

## UI calls

Forge `invoke(name,payload)` returns `{ok:true,data}` or `{ok:false,error:{code,message,details?}}`.

| Method | Payload | Result data |
| --- | --- | --- |
| `bootstrap` | `{projectKey?}` | `{user:{accountId,canApprove},projectKey,waivers,jobs,reservations,mode,discovery}` |
| `saveWaiver` | `{waiver,expectedVersion?}` | Saved waiver |
| `approveWaiver` | `{id,expectedVersion}` | Approved waiver |
| `renewApproval` | `{id,expectedVersion}` | Renewed waiver |
| `revokeWaiver` | `{id,expectedVersion,reason}` | Revoked waiver |
| `saveJob` | `{job,expectedVersion?}` | Saved canonical job |
| `checkCoverage` | `{waiverId,jobId}` | Coverage result |
| `reserve` | `{waiverId,jobId,requestId}` | `{reservation,coverage,idempotent}` |
| `cancelReservation` | `{id,reason}` | `{reservation,idempotent}` |
| `explainReservation` | `{id}` | `{reservation,coverage,waiver,job}` |

Coverage returns `status` (`covered`, `not-covered`, `needs-review`), `checks` (key, label, pass/fail/unknown status, expected, actual, reason), `available`, `availableForThisJob`, `requested`, `waiverVersion`, `scopeHash`, `jobFingerprint`, `sourceFingerprint`, `checkedAt`, and `summary`.

Discovery contains `{limitPerType:40,truncated:boolean,consistency:'eventual'}`. The UI shows a recent-record notice when truncated. Only records whose related Jira issues are accessible to the current user are returned. Query results never determine authoritative balances. Newly created records may need refresh before appearing.

The actor comes from trusted Forge invocation context, never a client username or model input. Production may show an authorized empty workspace and never silently substitutes fixtures. The explicit local demo uses isolated fictional state and a visible LOCAL DEMO label. It is not evidence of Forge integration.

## Domain/service

Pure domain code validates records, computes canonical SHA-256 fingerprints and evaluates coverage. The ledger service accepts `(payload,{actorId})` and injects repository, authorization, trusted source lookup, clock and bounded retries.

Repository methods: `get(type,id)` and `compareAndSwapTransaction({checks,writes})`. A check is `{type,id,version}`; null means absence. A write is `{type,id,value}`. All conditions and writes commit atomically. The Forge adapter merges each write's check into its transaction operation, checks read-only keys separately, and uses `notExists` or exact version equality. Waiver, job, reservation and audit changes share one transaction. The first approval includes its source-binding creation; allocation and renewal also check that immutable binding in the same transaction. Direct record reads determine balances; queries only discover records.

The platform adapter verifies current Jira access and project-admin permission. Fingerprints cover the issue and attachment metadata, not attachment bytes. Jira reads and Forge storage commits are separate systems: the source is checked at operation time and revalidated later, with no claim of a cross-system lock.

## Honest evidence

Verify concurrent requests of 120 and 100 against 180 remaining, duplicate retry, canonical job uniqueness, competing approvals for one source, exact scope boundaries, revocation, cancellation and renewal. Existing quality-management products already cover deviations; differentiation is this focused Jira coverage-and-allowance experience, not a world-first claim.

Deployment, installed-site UI, external MCP consent, judge installation link and submission each require an actual result. Local tests and screenshots cannot substitute for them. Use fictional, noncritical packaging examples in demonstrations.
