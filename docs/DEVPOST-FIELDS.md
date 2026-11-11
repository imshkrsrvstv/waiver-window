# Devpost fields — ready-to-paste draft

Prepared 11 November 2026. Copy only the field content, not the editorial notes. This file is not a submission receipt. External connectivity, independent judge installation and final video remain separate gates in [SUBMISSION-CHECKLIST.md](SUBMISSION-CHECKLIST.md). Actual form prompts and limits take precedence; these names follow Devpost's [submission guide](https://help.devpost.com/article/126-know-your-submission-steps).

## Project name

Waiver Window

## Tagline

A Jira approval has a boundary. Check exact scope, allocate its finite allowance, and keep agents read-only.

## Main category

Apps for Specialized Industries

## Bonus selection

None in the current entry. External MCP execution remains unverified, so no MCP bonus claim is made. No Teamwork Graph or Marketplace claim is made.

## Built with

Atlassian Forge, Jira, Rovo, Atlassian MCP, Forge Custom UI, JavaScript, Node.js, Vite, HTML, CSS.

These describe the actual app. Add only tags the form supports; do not label the product React, Confluence, Teamwork Graph or an external AI API.

## Project story

## Inspiration

A manufacturing exception can be approved and still fail to cover the next job. It might apply to one supplier, revision, plant, set of lots, time window and quantity. The useful question is not simply whether an approval exists. It is whether this exact job is still inside its boundary.

Waiver Window gives supplier-quality and production coordinators who already work in Jira one place to answer that question.

## What it does

A scoped permit sits beside the proposed job. The app compares the actual conditions, shows the values behind each result, and distinguishes a match from a mismatch or missing evidence. A project administrator explicitly approves the scope; an agent cannot grant that authority.

Quantity is a shared allowance. In the fictional packaging example, a permit allows 500 pieces. Allocating 320 leaves 180. Requests for another 120 and 100 cannot both fit. The app's conditional transaction checks the current ledger and writes the allocation and receipt together. Duplicate retries do not allocate twice; cancellation restores the allowance once and retains its history.

Within each installation, the first approval also binds the source issue to one permit. Creating another draft from the same source cannot produce a second approved allowance. Revocation or a scope revision does not release that source ownership. Source changes stop positive coverage pending human review. Scope changes require fresh approval, and old receipts keep the facts that applied when they were recorded.

## How it is built

Waiver Window runs on Atlassian Forge, with a Jira project page and issue panel built in Custom UI. Forge functions read the relevant Jira issues as the current user, apply explicit permissions, and use Custom Entity Store conditional transactions for the allowance ledger.

The domain engine evaluates exact identifiers, dates, source freshness, approval and remaining quantity. It does not ask a language model to decide whether an exception is valid. The authoritative balance comes from direct record reads, rather than a sum over an eventually consistent search.

The Rovo agent and Atlassian MCP module expose three read-only operations: check coverage, get remaining allowance and explain a reservation. These share the UI's permission-aware service. They cannot edit a permit, approve, allocate or cancel. External access requires administrator enablement and the invoking user's authorization.

## Challenges

The difficult cases happen between actions: two requests compete, a job changes, the source is edited or an approval is revoked. The implementation keeps those facts versioned, retries safely and retains original receipt snapshots. Unknown evidence stops the decision instead of becoming a reassuring green badge.

There is also an important boundary: Jira reads and Forge storage are separate systems. The app checks the source at the time of a request, but it cannot lock a Jira document and an external production process into one transaction. It is a review aid and app allocation ledger, not inventory control, a safety certification or physical shipment authority.

## What is distinctive

The product combines a narrow per-job coverage check, a finite shared allowance and traceable explanations that agents can read without gaining approval authority. The interface makes that mechanism visible: a scoped permit, a measured allowance ruler and inspectable receipts, with complete light and dark themes.

Deviation management already exists. Quality Events for Jira is a direct alternative; Empower QLM describes quantity- and time-bounded temporary deviations; ERP systems such as IFS already connect waiver references to inventory. Waiver Window's proposed advantage is a focused Forge-native workflow and its permission-aware explanation surface. Published competitor material does not establish a missing feature, and no superiority claim is based on an unperformed trial.

## Engineering results

The reviewed release passes 45 local domain, ledger and platform-adapter tests. A clean extracted release also passes 13 browser journeys, eight automated accessibility states, and targeted checks for tool identifiers, retries, source ownership and strict content security policy. The concurrent-request invariant is covered by the service test; these local results are distinct from installed-site or external-client evidence.

Installed production verification passed through the normal Jira interface: approve the existing 500-piece draft, allocate 320 pieces leaving 180, allocate a second 120 leaving 60, block a 100-piece request that exceeds that balance by 40, cancel the 120-piece allocation and restore 180 remaining, then reject an 80-piece job for Chennai when Pune is required even though its quantity fits. These are sequential actions, not a live concurrency test.

Three read-only Rovo/MCP tools are implemented. External MCP execution remains unverified: authorization reached the consent screen, but returned an error before the callback. The cause has not been established. The installed Jira workflow is verified separately.

## Next steps

Test the workflow with supplier-quality coordinators already using Jira: wrong revision, competing allocations and an expired or revoked exception. Measure correct decisions and time to supporting evidence, then decide whether a focused pilot is worthwhile. ERP synchronization and finer approval roles should follow that evidence. Customer adoption and time savings have not yet been measured.

## Main technology requirement

Waiver Window is a Forge app integrated with Jira. Its manifest declares a Jira project page and issue panel backed by Custom UI and Forge functions, plus a Rovo agent and rovo:mcp module. The app reads linked issues as the current Jira user and stores its own permits, jobs, reservations, immutable source bindings and audit events in Forge Custom Entity Store. Conditional transactions enforce shared allowance and immutable source ownership; server-side project and issue permissions protect human actions. The production bundle calls Forge bridge directly and never falls back to local fixtures.

## MCP candidate notes — not selected for this entry

Waiver Window exposes ww-check-coverage, ww-get-remaining and ww-explain-reservation through the rovo:mcp module, using GET actions. An authorized outside agent can inspect the same scoped coverage checks, allowance and receipt provenance as the Jira interface. The tools retain the invoking user's access checks and have no mutation path: approval, allocation, cancellation and scope changes remain explicit human actions. This makes the answer useful to an agent without treating the agent's confidence as permission.

Editorial gate: do not publish this as a verified external integration until an actual client result exists. Append the real client name, demonstrated tool, observed result and video timestamp after verification. A deployed manifest alone is insufficient.

## New work during the event

Waiver Window was created on 11 November 2026. The entry includes its exact-scope domain engine, transaction-backed allowance ledger, source ownership and approval lifecycle, Jira Custom UI, read-only Rovo/MCP actions, tests and setup documentation. It is a new project, not a renamed earlier hackathon submission.

## Judge setup field

[Install Waiver Window for Jira](https://developer.atlassian.com/console/install/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae?signature=AYABeAtzhE%2FzmYY60ny7bNeXlHIAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBV8VdAUh4Z%2BZaj49WpsqDPwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDFSAksKaWMa5FpBdQIBEIA7MjTNLZ0dOl3UsMN1Gmi4AsTJfTyG%2Bhv528Ib12qxC%2B6qsP7g4nYVW5PoOV1xeggXdT8oTt9cAZ1YsX0AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfpTACAZDyXrmiC0vwkmy%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMHANLEB9NHwfm%2F7jTAgEQgDuSDImoAsW1jIFEGjHdWrS4Ttm94VZFR3ppfJci3mAK0Tcyf4GAq0tjCN1dr%2BlGk3N7Zu9ulkCgFwrStwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARQqvgJLEKzwThaCXam52okAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzZEHHoubZCNLXD9pgCARCAO%2FFHB65GbvjWgz8GQPHW%2FndrT5WOQLaRAopTK6OaoXAPlctu9gnUN9x7f4%2F6H9crZz8CfFWUlwq6ODELAgAAAAAMAAAQAAAAAAAAAAAAAAAAAOx1Afrnd68xdB7SouKfrOD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLTf4waqVgPyU9o5atXzynymcSFhieJ9eayer2Q11V5TbF0ZDsa9fcRVaKkDDax4wUga%2Fulorj4z5vgJ6kmSTWjNqk%3D&product=jira). The installer preview is verified; a separate judge-site installation has not yet been completed. A Jira administrator must install it on a site with Jira; Rovo and administrator-enabled external tools are needed for the agent/MCP portion. Open a project where you can read and edit fictional test issues. Approval, revocation and renewal require the actual project-administrator permission.

Create an accessible source issue and separate job issues, then follow the fictional 500-piece walkthrough in the linked demo guide. The app starts empty on a new installation and does not import demo records into a judge's site. For external MCP, open the app in Atlassian Administration → Connected apps → Details, find TOOLS and enable “Expose tools to MCP-compatible apps.” Authorize the client with the same user and use the exact Permit ID and Job ID shown in the app's provenance section. These controls apply separately to each installation. Full configuration and limitations are in the linked deployment guide.

The actual installation and public guide links are recorded below. A separate clean-site installation and walkthrough remain unverified.

## Links — fill only from verified results

| Field                         | Current value                                                        | Before pasting                                                                |
| ----------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Production judge installation | [Install Waiver Window for Jira](https://developer.atlassian.com/console/install/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae?signature=AYABeAtzhE%2FzmYY60ny7bNeXlHIAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBV8VdAUh4Z%2BZaj49WpsqDPwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDFSAksKaWMa5FpBdQIBEIA7MjTNLZ0dOl3UsMN1Gmi4AsTJfTyG%2Bhv528Ib12qxC%2B6qsP7g4nYVW5PoOV1xeggXdT8oTt9cAZ1YsX0AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfpTACAZDyXrmiC0vwkmy%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMHANLEB9NHwfm%2F7jTAgEQgDuSDImoAsW1jIFEGjHdWrS4Ttm94VZFR3ppfJci3mAK0Tcyf4GAq0tjCN1dr%2BlGk3N7Zu9ulkCgFwrStwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARQqvgJLEKzwThaCXam52okAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzZEHHoubZCNLXD9pgCARCAO%2FFHB65GbvjWgz8GQPHW%2FndrT5WOQLaRAopTK6OaoXAPlctu9gnUN9x7f4%2F6H9crZz8CfFWUlwq6ODELAgAAAAAMAAAQAAAAAAAAAAAAAAAAAOx1Afrnd68xdB7SouKfrOD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLTf4waqVgPyU9o5atXzynymcSFhieJ9eayer2Q11V5TbF0ZDsa9fcRVaKkDDax4wUga%2Fulorj4z5vgJ6kmSTWjNqk%3D&product=jira) | Installer preview verified; independent installation remains unverified |
| Public source/release         | https://github.com/imshkrsrvstv/waiver-window                                                              | Publish reviewed source; open its real URL                                    |
| Public setup guide            | https://github.com/imshkrsrvstv/waiver-window/blob/main/docs/DEPLOYMENT.md                                                              | Verify guide is accessible without the owner's session                        |
| Public YouTube demo           | Pending                                                              | Real walkthrough, under five minutes, playback reviewed                       |
| External MCP endpoint         | https://mcp.atlassian.com/forge/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae | Endpoint derives from registered app; live authorization/result still pending |
| Devpost project               | Pending                                                              | Record actual project URL and separate submitted confirmation                 |

The private development tenant is not a substitute for an installable judge link. Do not use the editorial-only film as the demo video.

## Thumbnail and image caption

Use `assets/devpost-thumbnail.png`: original 3:2 artwork, 1440 × 960. Caption: **An approval has a boundary. Waiver Window checks exact scope and tracks a finite shared allowance. Illustrative quantities; not a live screenshot.**

Gallery screenshots must come from the current installed app and omit account identifiers. Local fixture screenshots must be labeled as such.

## Personal feedback, ownership and declarations

The owner has now confirmed the Codegeist eligibility, conflicts and ownership points recorded in the checklist. Personal learning feedback still belongs to the entrant. Existing feedback about another hackathon does not establish a Codegeist experience. Technical lessons above may inform an honest answer; do not invent enthusiasm, prior manufacturing experience, customer interviews or personal usage.

If the form asks about AI assistance, answer it accurately. AI-assisted implementation and editorial production do not imply an unaided human build. Third-party software and fonts retain their licenses and notices.

## Supporting research

The workflow is described in [NORMA's supplier manual](https://www.normagroup.com/content/dam/normagroup-com/en/global/about-us/purchasing/NORMA-Group-Supplier-Quality-Manual.pdf) and [Gestamp's supplier manual](https://purchasingarea.gestamp.com/script/login/GES/spa/docs/GES_Manual_Calidad_Proveedores.pdf). Those establish a bounded approval workflow, not customer demand for this implementation.

Closest published alternatives: [Quality Events for Jira](https://marketplace.atlassian.com/apps/3669831043/quality-events-for-jira?hosting=cloud&tab=overview), [Empower QLM temporary deviations](https://www.empowerqlm.com/your-temporary-deviation-was-approved-whos-tracking-when-it-ends/), [IFS inventory model](https://docs.ifs.com/techdocs/26r2/060_development/027_base_server_dev/010_model/060_business_objects/040_list_of_business_objects/markdown_files/InventoryPartInStockBusinessObject/). No competitor trial or benchmark was performed.
