# Judge walkthrough

Replay the core workflow in your own Jira project: approve an exact exception, allocate a finite allowance, reject a request that no longer fits, cancel one allocation, and inspect a plant mismatch. These are **sequential actions**, matching the verified production walkthrough.

[Watch the public walkthrough](https://youtu.be/YmgVQLZgSYg) — **2 minutes 50.5 seconds**, with English subtitles. It uses actual Jira captures and fictional records; the recorded requests are sequential. The [installation guide](DEPLOYMENT.md#judge-distribution) contains the actual production sharing link. The installer preview has been verified; a separate judge-site installation and clean-site replay have not yet been verified.

[View the submitted Codegeist project](https://devpost.com/software/waiver-window). Final submission and its event association were confirmed on 11 November 2026.

## Install and prepare five fictional issues

A Jira site administrator installs the app. Use an authorized project where you can create, read and edit fictional issues. Approval, renewal and revocation require that project's administrator permission. The ordinary Jira workflow needs no external API key or MCP client.

Create these five ordinary Jira issues and keep their actual keys. Waiver Window does not create them for you. Do not reuse the creator's issue keys; they belong to a separate site.

| Issue | Suggested title | Purpose |
| --- | --- | --- |
| Source | Gift sleeve print-tone variation | Describes the fictional cosmetic exception and its exact scope below |
| First job | Earlier gift-sleeve allocation | 320 pieces, lot LOT-26-A, Pune |
| Cedar | Cedar gift sleeves / lot A | 120 pieces, lot LOT-26-A, Pune |
| Maple | Maple gift sleeves / lot B | 100 pieces, lot LOT-26-B, Pune |
| Mismatch | Chennai packing run | 80 pieces, lot LOT-26-A, Chennai |

These are noncritical gift sleeves with a cosmetic print-tone variation, unrelated to real customers, shipments, food contact or safety functions. Use only fictional or otherwise authorized information.

## Create the permit and jobs

Open **Waiver Window** from the project navigation. A new installation starts empty and does not copy the creator's records. Create a permit linked to your source issue using these exact fields:

| Field | Value |
| --- | --- |
| Title | Gift sleeve print-tone variation |
| Supplier | Nori Printworks |
| Part | SLEEVE-04 |
| Revision | C |
| Plant | Pune |
| Allowed lots | LOT-26-A and LOT-26-B |
| Unit | pieces |
| Quantity limit | 500 |
| Effective date/time | Before your current test, for example yesterday |
| Expiry date/time | After your current test, for example seven days from now |

**Choose dates relative to the time you actually run this test.** Do not copy the film's November dates: that example expires. Keep the window unchanged through the walkthrough. The form displays local time and stores precise timestamps.

Create four jobs in the app linked to the corresponding actual job issue keys. Use the same supplier, part, revision and unit as the permit; use each job's quantity, lot and plant from the first table. Each job is canonical to its Jira issue, so use four separate issues.

If you already approved a permit for this source, use that existing allowance. The first approval permanently binds one permit to its source within the installation. Another draft cannot create a second approved allowance; revocation does not release the binding. For a fresh independent replay, create a new fictional source and four new job issues rather than trying to duplicate an existing source's allowance.

## Replay the verified sequence

1. **Check the 320-piece job while the permit is a draft.** Coverage must stop for review; the draft does not authorize an allocation.
2. **Approve the permit.** As a project administrator, review the exact scope and linked source, then explicitly confirm approval. The limit is still 500 and nothing has been allocated yet.
3. **Check and allocate 320.** Select the first job, run the coverage check, review the allocation dialog and confirm. Expect **320 allocated, 180 available**.
4. **Check and allocate Cedar's 120.** Its identifiers match. Confirm the allocation. Expect **440 allocated, 60 available**.
5. **Check Maple's 100.** Its quantity exceeds the 60 available by 40. The quantity condition fails and allocation remains disabled. Do not allocate this job.
6. **Cancel Cedar's 120 allocation.** Select its existing allocation, enter a fictional test reason and confirm cancellation. Expect **320 allocated, 180 available** again. The historical record remains; cancellation does not erase it.
7. **Check the Chennai job's 80.** Quantity fits the 180 available, but the plant does not. Expand the plant condition to see **expected Pune, actual Chennai**. Allocation remains disabled.
8. **Inspect history.** The first 320-piece allocation is active and Cedar's 120 is cancelled. The remaining allowance is 180. Switch between light and dark themes to inspect the same records. Receipts include actor/account provenance, so do not publish an unredacted receipt containing personal identifiers.

If a condition differs, read its expected and actual values rather than bypassing it. Check the issue permissions, exact identifiers, approval state and current dates. Editing the source after approval intentionally makes coverage require review; leave the source unchanged during this basic replay.

## Optional engineering checks

These are separate from the recorded production walkthrough. Their local automated tests are documented in [TESTING.md](TESTING.md); live execution has **not** been verified for these advanced cases.

- **Overlapping requests:** the conditional ledger is designed to admit at most one of 120 and 100 when only 180 remains. A live concurrency claim requires actual overlapping authenticated requests and recorded results. Sequential clicks do not establish it.
- **Changed source and renewal:** edit only a fictional source, then recheck. Positive coverage should stop. Renewal requires an administrator, an approved and unexpired permit, unchanged scope and zero active allocations. Old receipts retain their original snapshots. Revoke is a separate action and cannot be undone by renewal.
- **Duplicate retries and source ownership:** retry the same request without creating a new allocation; verify a second draft cannot approve against an already-bound source. These invariants have local tests; their installed-site retry/concurrency evidence remains separate.
- **External MCP:** three read-only tools are implemented. Administrator exposure is enabled on the creator's test installation, but three authorization attempts returned an error after consent and before callback. No external tool result is verified, and the current entry claims no MCP bonus. A separate installation requires its own administrator enablement and user consent; see [DEPLOYMENT.md](DEPLOYMENT.md). An agent cannot approve, allocate or cancel.

Waiver Window records an app allowance and supports human review. It does not control physical inventory, release shipments or certify product safety.
