# Data handling

This notice describes Waiver Window 0.1.0. It is a development release for evaluating a scoped approval workflow with fictional or otherwise authorized test data.

## Data used and stored

The backend reads linked Jira issues as the signed-in user. It reads issue identity, project, summary, description, status, labels, update time and attachment metadata to verify access and compute a source fingerprint. It does not download attachment files. The source fingerprint is a hash; the full Jira description and attachment contents are not copied into the app ledger.

The app stores the fields people enter: permit and job titles; linked issue and project keys; supplier, part, revision, plant and lot identifiers; dates, units and quantities; approval state; source and job fingerprints; allocation receipts; reasons for revocation or cancellation; immutable source-to-permit ownership bindings; and audit events. Records include the acting Atlassian account ID and timestamps. Receipts retain the original scope and job snapshots so later changes do not rewrite history. Do not enter confidential material that is unnecessary for this evaluation.

These records use Forge Custom Entity Store, scoped to the app installation. Atlassian hosts this storage; its location follows the host Atlassian app rather than a country chosen by this repository. An administrator should confirm the site's location before using real organizational data. [Forge data residency](https://developer.atlassian.com/platform/forge/data-residency/).

## Access and sharing

The backend rechecks relevant Jira issue access before returning records. Approval, renewal and revocation require Jira project-administrator permission. It uses the caller's platform identity, not a user-entered approver field. Downloading a receipt places a copy on that person's device; they control subsequent sharing of it.

The app has no external egress domains, external model endpoint, advertising service or custom analytics. Its code does not log issue bodies, credentials or ledger records. Atlassian still operates the underlying platform and its diagnostic systems. The optional Rovo reviewer is an Atlassian feature. If an administrator enables external MCP and a user connects a client, requested tool results are provided to that client; the client's own processing and privacy terms then apply. No external client is connected automatically.

The local demonstration stores fictional records and theme preferences in browser local storage. **Reset demo** clears the fictional records. Clearing that site's browser storage also removes its local preference and demonstration data; it does not delete an installed Forge ledger.

## Retention and removal

This version has no automatic retention schedule or individual-record erasure screen. Cancellation and revocation preserve audit history and are not deletion. Do not interpret either action as removing personal data.

A site administrator can uninstall the app. Atlassian's storage overview currently describes a 28-day retention period after uninstallation and a recovery request window of 21 days; reinstallation does not automatically restore the former ledger. Platform backup and final deletion behavior follow Atlassian's policy, beyond the app's control. Review the current [storage overview](https://developer.atlassian.com/platform/forge/storage-reference/) and [data lifecycle documentation](https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/) before relying on a retention or recovery period.

## Contact

For ordinary support, use the [repository Issues page](https://github.com/imshkrsrvstv/waiver-window/issues). Do not post tokens, personal records, private issue descriptions or downloaded receipts in a public issue. This document records the implementation's behavior; it does not certify compliance with a particular law or organizational retention policy.
