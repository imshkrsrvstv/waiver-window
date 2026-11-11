# Verification record

Snapshot: 11 November 2026. Local tests, installed-site evidence, external MCP connectivity and judge distribution are different levels of evidence.

## Passed locally

| Check                                     | Result                                                                                                                       | Evidence                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Domain, ledger and platform-adapter tests | 45/45 passed with `npm test`                                                                                                 | `test/domain.test.mjs`, `test/ledger.test.mjs`, `test/adapters.test.mjs`    |
| Browser journeys                          | 13 critical journeys passed; no captured browser errors                                                                      | `static/app/qa/artifacts/verification.json`                                 |
| Automated accessibility                   | Eight light/dark × desktop/mobile × coverage/dialog states, zero reported violations                                         | `static/app/qa/artifacts/accessibility.json`                                |
| Production separation and strict CSP      | Five checks passed: no fixtures, safe missing-host failure, exact ruler widths, external theme bootstrap and persisted theme | `static/app/qa/artifacts/production.json`                                   |
| Copyable tool identifiers                 | Three checks passed: exact copy, manual fallback when blocked, and mobile accessibility in both themes                       | `static/app/qa/artifacts/identifiers.json`                                  |
| Cancelled-request retry messaging        | Two targeted checks passed: historical receipt retained and no new allocation claimed                                        | `static/app/qa/artifacts/cancelled-retry.json`                              |
| Source ownership guidance/parity          | Three targeted local checks passed: second approval rejected, permanent-link guidance, revocation retains ownership         | `static/app/qa/artifacts/source-binding.json`                              |
| Production and explicit demo builds       | Both build successfully into different directories                                                                           | `static/app/dist`, `static/app/dist-demo`                                   |
| Dependency review                         | Zero findings in the captured backend audit; UI reviewed and patched separately                                              | `dependency-audit.json`, `DEPENDENCIES.md`, `../static/app/DEPENDENCIES.md` |

The ledger suite uses an in-memory repository that implements conditional transactions. Platform adapter tests use mocked Jira and Forge clients. They prove the local behavior under those models, not the availability or behavior of an installed Atlassian tenant.

The browser suite uses the clearly labeled local adapter. It covers positive allocation, mismatched plant, explicit approval, cancellation, revocation, title-only edits, changed-source renewal, theme persistence and narrow-screen dialogs. Automated accessibility is useful coverage, not a claim of exhaustive accessibility certification. Screenshots were visually reviewed in both themes.

## Critical invariants

1. Against 180 available units, concurrent requests for 120 and 100 accept exactly one in the service test. The limit is never exceeded and a failed request leaves no partial receipt.
2. Retrying a request returns the same allocation once. Reusing its ID for different facts conflicts. Creating a second app record cannot duplicate the same Jira job.
3. Cancellation restores once while retaining original snapshots. An edited job cannot inherit its old receipt's coverage.
4. Supplier, part, revision, plant, lot, project, unit, dates, approval and source state are explicit conditions. Unknown or changed evidence never becomes covered.
5. Approval actors and permission checks are server-owned. A payload claiming administrative authority does not gain it.
6. Active allocations block scope changes. Renewal requires a fresh trusted source, zero allocations, unchanged scope, current version and an approved, unexpired permit. Revocation winning a race prevents renewal.

7. Alternative drafts sharing a source can acquire only one approved allowance. The source claim, approval and audit commit together; revocation does not release the claim. Missing or foreign source bindings block approved coverage, allocation and renewal. An existing unapproved draft preserves its ID when approved.

## Installed-site acceptance

Observed 11 November 2026 in the normal production Jira project page. Production 2.2.0 and development 2.3.0 are deployed and installed. Exact account, site and record identifiers remain in private operational evidence.

| Verification | Observed result |
| --- | --- |
| Existing draft and human approval | Draft coverage was blocked. Explicit approval preserved the existing permit ID and its 500-piece scope. |
| First allocation | A checked 320-piece job allocated successfully: 320 allocated, 180 remaining. |
| Sequential second allocation | A 120-piece job allocated successfully: 440 allocated, 60 remaining. |
| Over-allowance protection | A 100-piece job failed quantity by 40; its allocation button was disabled. |
| Cancellation | Cancelling the 120-piece allocation returned the explicit restoration message and showed 320 allocated, 180 remaining. Duplicate cancellation was not tested live. |
| Exact plant scope | An 80-piece Chennai job failed the expected Pune plant condition while quantity passed; allocation remained disabled. |
| External MCP | Exposure enabled. OAuth reached consent but failed before callback; no token or authenticated tool result. Cause unestablished. |

The live run used sequential actions. Actual overlapping concurrency, duplicate requests, duplicate cancellation, competing source approvals, source-edit renewal, revocation, restricted-user access and the issue panel remain unverified on the installed site. Their local tests do not replace that evidence. Judge distribution and the final public video are pending. The current entry makes no live MCP bonus claim.

## Repeat checks

Run `npm test` for deterministic tests and `npm run check` for syntax, test and verified AppleDouble cleanup. Build both UI modes before the production security-policy check. Portable browser harness commands are described in `../static/app/README.md`. Generated browser reports and screenshots are intentionally excluded from the source release; rerunning the harness recreates them.

For live concurrency, use the normal resolver under the authenticated user's authority. An integration test may dispatch both requests together and preserve their timestamps/results. Label such footage **Live integration test**; two sequential clicks are not evidence of simultaneous requests. Never bypass permission checks or alter production balances merely to make a film look convincing.
