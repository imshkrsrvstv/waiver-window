# Codegeist submission draft

Paste-ready fields: [DEVPOST-FIELDS.md](DEVPOST-FIELDS.md). Current evidence gates: [SUBMISSION-CHECKLIST.md](SUBMISSION-CHECKLIST.md).

Status: prepared for review; **not evidence of a submitted entry**. The source and local tests are implemented. Development and production deployment, installation and project-page bootstrap are verified. Normal approval, sequential allocations, over-allowance protection, cancellation/restoration and plant mismatch passed in the installed production UI. The public judge installer preview is verified; the public film and English subtitles are published. Independent judge-site installation, external MCP and final Devpost submission remain separate verification gates.

## Entry positioning

**Name:** Waiver Window  
**Tagline:** An approval has a boundary. Check whether this job is still inside it.  
**Category:** Apps for Specialized Industries  
**Selected bonus:** None in the current entry. The MCP bonus is not claimed because external execution is unverified.

The deadline is 22 December 2026 at noon PST, or 23 December at 01:30 IST. The entry needs an installable Forge app, configuration instructions, a project description, and a public YouTube video under five minutes showing it working. The MCP bonus uses `rovo:mcp`. These requirements were rechecked on 11 November 2026. [Official rules](https://codegeist2026.devpost.com/rules)

## Project description draft

### Inspiration

“Approved” is a useful status, but it does not answer whether an exception covers the job in front of you. A temporary manufacturing concession can be limited to one supplier, part revision, plant, set of lots, time window and quantity. When several coordinators work from the same approval, the remaining scope matters as much as the original decision.

Waiver Window focuses on that last operational question: does this exact job still fit this exact approval?

### What it does

Waiver Window puts a scoped exception and a job beside each other inside Jira. A reviewer records the precise conditions and explicitly approves them. The coverage desk compares each condition, displays the supporting values and explains mismatches or missing evidence.

Within one installation, a source issue can own only one approved permit allowance. Alternative drafts cannot duplicate it: the first human approval claims the source atomically, and revocation does not free it for a competing draft.

Quantity is a shared allowance. If 500 pieces are allowed and 320 are already allocated, the remaining 180 cannot cover two new requests of 120 and 100 together. The server checks the current revision and commits the allowance change, job allocation and receipt together. Duplicate retries do not allocate twice. Cancellation restores the allowance once while preserving history.

The source matters too. A changed Jira approval source stops positive coverage until human review. Scope changes require fresh approval. A renewed source does not rewrite earlier receipts.

### How it is built

The app uses Forge Custom UI in a Jira project page and issue panel, Forge functions, and Custom Entity Store conditional transactions. A plain JavaScript domain engine evaluates exact identifiers, dates, approval state, source freshness and quantity. The authoritative balance comes from direct record reads, not an eventually consistent search sum.

Jira access is checked as the current user. Approval, revocation and renewal require the actual project-administrator permission. Human identity comes from the Forge runtime, not a form field or an agent prompt.

The Rovo agent and `rovo:mcp` module expose the same three read-only operations: check coverage, get remaining allowance and explain a reservation. No agent action can approve, allocate, edit or cancel. External connectivity is included in the final entry only after administrator enablement, OAuth consent and an actual successful client invocation have been recorded.

### What is distinctive

Waiver Window is deliberately small: a precise per-job coverage decision, a finite shared allowance and an explanation that can travel to an agent without giving the agent approval authority. The interface makes these relationships visible through a scoped permit, a measured quantity ruler and traceable receipts.

Quality-management systems already handle deviations and concessions. [Quality Events for Jira](https://marketplace.atlassian.com/apps/3669831043/quality-events-for-jira?hosting=cloud&tab=overview) is a direct alternative, and [Empower QLM](https://www.empowerqlm.com/your-temporary-deviation-was-approved-whos-tracking-when-it-ends/) discusses bounded temporary deviations. The differentiation is this focused combination and experience; it is not a claim that deviation management or allocation was invented here. Competitor trials remain future work.

### Challenges and engineering choices

The hard part was preserving a human decision when several things change: two requests compete, a job is edited, a source changes, or approval is revoked. The implementation treats those as versioned facts rather than a reassuring status label. Conditional transactions prevent partial app-ledger writes; original snapshots keep the past understandable; unknown evidence stops the decision.

The product also needs a coherent operational interface. Porcelain surfaces, ink typography, copper controls and a brass allowance ruler distinguish the approved scope from the proposed work. Both themes, mobile layouts and explicit confirmation states are complete.

### What is next

Validate the workflow with supplier-quality coordinators who already use Jira, measuring correct decisions and time to supporting evidence. The next product decision is whether the focused allowance workflow saves enough effort to justify a pilot. ERP synchronization, finer approval roles and richer discovery should follow demonstrated needs.

This release is a review aid and app allocation ledger. It does not certify nonconforming goods, control inventory, authorize a physical shipment or replace a quality-management system. No customer adoption, cost saving or award is claimed.

## MCP implementation status — no current bonus claim

Waiver Window exposes `ww-check-coverage`, `ww-get-remaining` and `ww-explain-reservation` through `rovo:mcp`, using GET actions. The agent receives structured scope conditions, remaining allowance and receipt provenance from the same permission-aware service used by the UI. It cannot mutate approval or quantity. A project administrator remains responsible for approval decisions.

Three read-only Rovo/MCP tools are implemented. External MCP execution remains unverified: authorization reached the consent screen, but returned an error before the callback. The cause has not been established. The installed Jira workflow is verified separately. A future bonus claim would require a real client invocation; the manifest alone is not connectivity evidence. Rovo MCP is currently a Preview capability; administrator enablement and client authorization are part of installation guidance. [Official module documentation](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/)

## Publication gates and links

| Item                          | Current state                                | Required final evidence                                               |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Public source/release         | [Public source](https://github.com/imshkrsrvstv/waiver-window); source release 0.1.0                       | Actual URL, license/dependency review, secret scan                    |
| Production judge installation | [Install Waiver Window for Jira](https://developer.atlassian.com/console/install/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae?signature=AYABeAtzhE%2FzmYY60ny7bNeXlHIAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBV8VdAUh4Z%2BZaj49WpsqDPwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDFSAksKaWMa5FpBdQIBEIA7MjTNLZ0dOl3UsMN1Gmi4AsTJfTyG%2Bhv528Ib12qxC%2B6qsP7g4nYVW5PoOV1xeggXdT8oTt9cAZ1YsX0AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfpTACAZDyXrmiC0vwkmy%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMHANLEB9NHwfm%2F7jTAgEQgDuSDImoAsW1jIFEGjHdWrS4Ttm94VZFR3ppfJci3mAK0Tcyf4GAq0tjCN1dr%2BlGk3N7Zu9ulkCgFwrStwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARQqvgJLEKzwThaCXam52okAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzZEHHoubZCNLXD9pgCARCAO%2FFHB65GbvjWgz8GQPHW%2FndrT5WOQLaRAopTK6OaoXAPlctu9gnUN9x7f4%2F6H9crZz8CfFWUlwq6ODELAgAAAAAMAAAQAAAAAAAAAAAAAAAAAOx1Afrnd68xdB7SouKfrOD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLTf4waqVgPyU9o5atXzynymcSFhieJ9eayer2Q11V5TbF0ZDsa9fcRVaKkDDax4wUga%2Fulorj4z5vgJ6kmSTWjNqk%3D&product=jira); installer preview verified | Independent clean-site installation and walkthrough remain unverified |
| Video | [Public YouTube walkthrough](https://youtu.be/YmgVQLZgSYg), 170.526 seconds, English subtitles published | Native publication and anonymous player readiness verified; audible playback is a separate check |
| External MCP bonus            | Module implemented; OAuth failed before callback; no bonus claimed       | Real client result, setup guide and video segment                     |
| Devpost entry | Start-project human verification pending; no draft or submission yet | Submitted project URL and confirmation |
| Entrant declarations          | Owner confirmed for Codegeist on 11 November | Retain curated confirmation; match any additional actual form prompts |

For judge distribution, deploy the verified production build and enable Sharing in the Forge developer console. Test the actual installation link. Marketplace-listed or licensed builds have distribution restrictions; do not break judge access to pursue an unselected Marketplace bonus. [Forge distribution guide](https://developer.atlassian.com/platform/forge/distribute-your-apps/)

Personal learning feedback belongs to the entrant. Technical lessons documented above can inform it; do not invent a personal experience or reuse another event's declarations as if they covered this event.

## Review map

The event evaluates implementation, design, impact, innovation and presentation. [Judging criteria](https://codegeist2026.devpost.com/)

Our review questions are: can judges install and reproduce the mechanism; can they see the human decision and quantity boundary; is the audience specific; is differentiation candid about alternatives; and does the film show the result clearly? These questions guide preparation, not a prediction of judging scores.
