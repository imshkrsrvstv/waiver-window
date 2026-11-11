# Deploy and verify Waiver Window

The local interface is a preview until the application has been registered, deployed and installed on an Atlassian site. Only actual provider results establish those steps. `manifest.yml` receives its real app ID from Forge registration; no sample ID should be deployed.

## Runtime and account

Use Node 24.22.2 (or another supported version in `package.json`) and the official Forge CLI. This release was deployed with CLI 15.1.0. Install developer tooling separately from the app, review package hooks, then authenticate interactively:

```sh
npm install --global @forge/cli@15.1.0
forge settings set usage-analytics false
forge login
```

Enter credentials only at the official login prompt. Never commit an API token or put it in command arguments. The CLI has its own dependency tree and installation hooks; the application's dependency scan does not audit that separate toolchain. Follow the [official setup guide](https://developer.atlassian.com/platform/forge/getting-started/).

Use a supported Node version. Install exact lockfile dependencies without running package hooks:

```sh
npm ci --ignore-scripts
npm --prefix static/app ci --ignore-scripts
npm run check
npm run build
```

The account needs a Developer Space, a site with Jira, and administrator rights for installation. Rovo must be enabled to test the agent and MCP tools. A free temporary demo development site can be requested with `forge site provision`; it expires after 90 days. Developer Space setup can require additional account/billing steps. The owner handles any payment commitment; no paid model endpoint is enabled by this app.

## Register, deploy, install

Run from this repository. For your own deployment, `forge register` replaces the checked-in public app identifier with a new app owned by your Developer Space; it does not grant access to the original deployment. Registration does not import another installation's data.

```sh
forge developer-spaces list
forge register 'Waiver Window' --developer-space-id YOUR_SPACE_ID
forge lint
forge deploy --environment development
forge storage entities indexes list --environment development
forge install --environment development --demo-site
```

Follow the official registration terms prompt. Wait until the `by-project-kind` index is ACTIVE before installation. For an existing site, choose its URL and Jira when `forge install` prompts instead of using `--demo-site`. Upgrade the existing installation when scopes or major module changes require it; do not uninstall merely to update the app, because uninstallation changes its storage lifecycle. A successful local build is not an installation result.

On an external drive, macOS may create `._` AppleDouble files alongside code. `npm run check` invokes `prepare:forge`, which removes only sidecars whose binary header verifies that metadata format. Run `npm run prepare:forge` before a standalone Forge lint/deploy if those files reappear; otherwise the Forge linter may try to parse them as source.

The app requests only `read:jira-work` and `storage:app`. It stores its own permits, jobs, reservations and audit records, and reads Jira issues as the current user. It does not change Jira status, send messages, create physical inventory transactions or write invoice data. There are no external API keys or external egress domains in the manifest.

## Prepare a fictional demonstration

Use an existing Jira project authorized for testing, with clearly marked fictional packaging or cosmetic-quality issues. The app needs existing, accessible issue keys; it will not invent real Jira records. Prepare one source issue describing a temporary exception and at least two job issues. Link them through the app's forms. Linking an existing permit to a different source issue requires a new permit. Content changes in its current source follow the explicit renewal workflow below.

Use a permit for 500 units and first record a real app allocation of 320, leaving 180. Attempt reservations of 120 and 100 from two distinct job issues at the same time. Exactly one may succeed. Refresh and verify a remaining balance of either 60 or 80 and one corresponding new receipt. Duplicate retries must not consume again. Cancellation must restore once. A different part revision, expired time, revoked permit or changed source must never allocate.

Approval and revocation require the actual `ADMINISTER_PROJECTS` permission returned by Jira. Saving a permit requires edit permission on its linked source; saving/reserving a job requires edit permission on its issue. Cancellation requires job edit access and either the original allocator or project administrator. An approval actor supplied through form fields, model inputs or payload context is ignored.

The source fingerprint covers issue identity, project, update time, summary, description, status, labels and attachment metadata. It is not a checksum of attached file bytes. A changed source is deliberately conservative: review and a fresh approval are required. Refreshing source before a transaction does not make Jira and Forge one database. Recheck receipts when using them; this app is not a safety interlock or shipment authority.

When an approved permit's source changes, cancel its active allocations first. A project administrator can then explicitly review the current linked source and renew approval for the unchanged scope. Renewal requires zero active allocations and a different verified source fingerprint, uses the expected record version, and writes an audit event. Old receipts retain their original source. A revoked permit cannot be silently revived through this action.

## Rovo and external MCP

The installed Rovo reviewer and MCP server share three GET actions: check coverage, get remaining allowance, and explain reservation. They use the same permission checks and domain engine as the interface. No tool can approve, allocate, edit or cancel.

After installation, a site or organization administrator must enable these tools for external clients in Atlassian Administration → Apps → Sites → selected site → Connected apps → Waiver Window. In the observed app interface, open Details, scroll to TOOLS, choose “Expose tools to MCP-compatible apps” → Enable tools, then confirm Enable. The control should show Enabled. There was no separate per-tool selection tab in this app interface. Exposure is off by default and configured separately for each installation. The endpoint is `https://mcp.atlassian.com/forge/APP_UUID`, with the UUID from the real registered app ID. Connecting an MCP client requires its own OAuth consent and site selection. Record an actual successful invocation before claiming external MCP connectivity.

The official Jira MCP tutorial documents a current limitation: remote `asUser()` execution also needs an app-consent entry for this app in the invoking user's Atlassian Connected apps. Verify that consent while opening the installed app, then connect the external client. Waiver Window intentionally retains `asUser()` and fails closed if user consent/access is unavailable; it does not fall back to app-wide authority. [Official MCP Jira tutorial](https://developer.atlassian.com/platform/forge/read-jira-issues-with-a-rovo-mcp-tool/).

Official references: [Rovo MCP](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/), [MCP tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-rovo-mcp/), [Jira permission API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/).

## Current integration evidence

Installed production verification passed through the normal Jira interface: approve the existing 500-piece draft, allocate 320 pieces leaving 180, allocate a second 120 leaving 60, block a 100-piece request that exceeds that balance by 40, cancel the 120-piece allocation and restore 180 remaining, then reject an 80-piece job for Chennai when Pune is required even though its quantity fits. These are sequential actions, not a live concurrency test.

Three read-only Rovo/MCP tools are implemented. External MCP execution remains unverified: authorization reached the consent screen, but returned an error before the callback. The cause has not been established. The installed Jira workflow is verified separately. Do not add broader scopes or replace current-user access with app-wide access to make an unverified connection appear successful.

## Judge distribution

[Install Waiver Window for Jira](https://developer.atlassian.com/console/install/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae?signature=AYABeAtzhE%2FzmYY60ny7bNeXlHIAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBV8VdAUh4Z%2BZaj49WpsqDPwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDFSAksKaWMa5FpBdQIBEIA7MjTNLZ0dOl3UsMN1Gmi4AsTJfTyG%2Bhv528Ib12qxC%2B6qsP7g4nYVW5PoOV1xeggXdT8oTt9cAZ1YsX0AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfpTACAZDyXrmiC0vwkmy%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMHANLEB9NHwfm%2F7jTAgEQgDuSDImoAsW1jIFEGjHdWrS4Ttm94VZFR3ppfJci3mAK0Tcyf4GAq0tjCN1dr%2BlGk3N7Zu9ulkCgFwrStwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARQqvgJLEKzwThaCXam52okAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzZEHHoubZCNLXD9pgCARCAO%2FFHB65GbvjWgz8GQPHW%2FndrT5WOQLaRAopTK6OaoXAPlctu9gnUN9x7f4%2F6H9crZz8CfFWUlwq6ODELAgAAAAAMAAAQAAAAAAAAAAAAAAAAAOx1Afrnd68xdB7SouKfrOD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLTf4waqVgPyU9o5atXzynymcSFhieJ9eayer2Q11V5TbF0ZDsa9fcRVaKkDDax4wUga%2Fulorj4z5vgJ6kmSTWjNqk%3D&product=jira). This is the actual production distribution URL, intended to be shared with evaluators.

The installer preview has been opened and checked: Waiver Window, Get app, For Jira, read-Jira and app-storage permissions, and the linked vendor policies. A separate judge-site installation and clean-site walkthrough have not yet been verified.

1. Open the link as an administrator of an eligible Jira site, review the permissions and policies, then choose **Get app** and the intended site.
2. Open a project where the evaluating user can read and edit fictional source/job issues, then open **Waiver Window** in the project navigation. Approval, revocation and renewal require that project’s administrator permission.
3. Follow [DEMO.md](DEMO.md). The app begins empty on a new installation; the owner’s records are not copied to it.
4. The basic Jira workflow does not require an external MCP client. External tools require separate administrator enablement and user authorization; successful external execution remains unverified.

After development-site verification, build and deploy to production, then enable Sharing in the Forge developer console's Distribution page. Capture the actual installation link and test it with an eligible site administrator. The source repository, video and Devpost description should distinguish local tests, installed-site evidence and public judge access.

Marketplace-submitted or licensed apps cannot use the same sharing installation link. If pursuing a Marketplace bonus, plan a separate unlicensed judge build rather than breaking the judge link. See [distribution rules](https://developer.atlassian.com/platform/forge/distribute-your-apps/).

## Limits and recovery

- Discovery lists are eventually consistent and bounded; authoritative balances come from strongly consistent direct record reads and conditional transactions. A refresh may be needed after a newly created record.
- An app record is scoped to its installation. It is not automatically filtered by Jira permissions; the backend performs those checks before returning it.
- Failed or ambiguous storage requests do not report success. Reservation request IDs make retries safe; retry with the original ID after an uncertain response.
- Forge Custom Entity schema/index changes can be restricted after production deployment. Treat schema changes as migrations and preserve existing receipt data.
- Development-site expiry removes the convenient demonstration environment. Maintain the production judge installation separately and document its lifecycle.

## Source binding and existing drafts

One Jira source issue can own one approved allowance stream in an installation. Alternative drafts may be prepared, but their first approvals compete for one immutable source binding. Only the winning permit can approve and allocate. A source binding remains attached to that permit after revocation, expiry or scope revision; it is not automatically released or transferred.

The binding is created in the same conditional transaction as explicit approval. An existing unapproved draft needs no migration: approve it normally to claim the source, retaining its identifier and scope. No record is deleted or rewritten during deployment. Previously approved legacy records without a binding fail closed and require a separately reviewed recovery plan; this release does not automatically backfill ownership from an eventually consistent query. To revise the owning permit, use its existing scope-edit and explicit approval workflow rather than creating another allowance for the same source.
