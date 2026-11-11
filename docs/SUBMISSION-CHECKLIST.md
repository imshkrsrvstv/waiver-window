# Codegeist submission checklist

Snapshot: 11 November 2026. [Final Codegeist submission](https://devpost.com/software/waiver-window) is confirmed by the native “Project submitted!” message and the resulting event association. Saved field text lives in [DEVPOST-FIELDS.md](DEVPOST-FIELDS.md); structured fields live in [devpost-fields.json](devpost-fields.json).

## Official requirements

Submit by 22 December 2026, noon PST (23 December, 01:30 IST). Build on Forge with an Atlassian integration; select a category and any supported bonus. Provide a working judge-installation link, complete configuration instructions, English materials and a feature/technology description. The public YouTube demonstration should stay below five minutes and show the actual working product. Own the submission rights, respect third-party licenses, and satisfy event-specific eligibility/conflict restrictions. The MCP bonus requires `rovo:mcp`. [Codegeist rules, sections 1–4](https://codegeist2026.devpost.com/rules)

Devpost recommends a 3:2 JPG, PNG or GIF thumbnail under 5 MB. A draft project is not a submitted hackathon entry: verify the final confirmation and Submitted state. [Submission fields](https://help.devpost.com/article/126-know-your-submission-steps), [submission confirmation](https://help.devpost.com/article/122-how-to-enter-a-submission)

## Entrant declarations

The owner confirmed adult eligibility, India residence and solo participation earlier. On 11 November the owner separately confirmed Codegeist affiliation/conflict restrictions, the named restricted-party lists, and ownership including employer-related rights. The orchestrator observed no sponsor/administrator funding or preferential development support; only publicly available Forge/free development tools were used. No further confirmation is outstanding on these points. Do not reinterpret the previous PayPal declaration as the basis for this event.

Keep only this curated confirmation; no identity documents, employer details or raw conversations belong in the release. Eligibility remains governed by the official rules rather than this engineering checklist.

## Evidence ledger

| Gate                    | Actual evidence at this snapshot                                                                                                                                                   | Remaining action                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Platform implementation | Real manifest, Forge functions, Custom UI, Jira integration, read-only Rovo/MCP actions                                                                                            | Compare final description to release manifest                                                |
| Build and local checks  | 45 backend tests; clean extracted production/demo builds; 13 browser journeys; eight accessibility states with no reported violations; targeted ID/retry/source-binding/CSP checks | Retest only if implementation changes                                                        |
| Deployment              | Production 2.2.0 and development 2.3.0 deployed and installed; active indexes; project-page bootstrap observed                                                                     | Core project-page workflow passed after the source-binding update; issue-panel check remains pending                          |
| Persistent workflow     | Production approval, sequential 320/120 allocations, over-allowance blocking for 100, cancellation/restoration and plant mismatch for 80 verified                                                                                                                                           | Remaining live concurrency/retry/renewal/revocation/permission checks only if claimed                           |
| Source ownership        | Local service concurrency and UI parity tests passed                                                                                                                               | Actual second-draft approval rejection if included in film                                   |
| Concurrent allowance    | Service test accepts exactly one of 120 and 100 against 180                                                                                                                        | Actual overlapping authorized live requests if presented as live concurrency                 |
| Changes and permissions | Local domain/platform tests cover stale sources, renewal, revoke and rejected authority                                                                                            | Installed-source edit/renewal and restricted-user verification if claimed                    |
| External MCP            | Test-installation external exposure Enabled in actual admin UI; registered endpoint and three GET actions exist                                                                                                                                    | Authorization failed before callback; no current MCP bonus claim                     |
| Judge installation | [Install Waiver Window for Jira](https://developer.atlassian.com/console/install/90d15fc4-8d94-4ac8-9775-3dcd62b4d6ae?signature=AYABeAtzhE%2FzmYY60ny7bNeXlHIAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBV8VdAUh4Z%2BZaj49WpsqDPwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDFSAksKaWMa5FpBdQIBEIA7MjTNLZ0dOl3UsMN1Gmi4AsTJfTyG%2Bhv528Ib12qxC%2B6qsP7g4nYVW5PoOV1xeggXdT8oTt9cAZ1YsX0AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgEfpTACAZDyXrmiC0vwkmy%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMHANLEB9NHwfm%2F7jTAgEQgDuSDImoAsW1jIFEGjHdWrS4Ttm94VZFR3ppfJci3mAK0Tcyf4GAq0tjCN1dr%2BlGk3N7Zu9ulkCgFwrStwAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARQqvgJLEKzwThaCXam52okAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzZEHHoubZCNLXD9pgCARCAO%2FFHB65GbvjWgz8GQPHW%2FndrT5WOQLaRAopTK6OaoXAPlctu9gnUN9x7f4%2F6H9crZz8CfFWUlwq6ODELAgAAAAAMAAAQAAAAAAAAAAAAAAAAAOx1Afrnd68xdB7SouKfrOD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLTf4waqVgPyU9o5atXzynymcSFhieJ9eayer2Q11V5TbF0ZDsa9fcRVaKkDDax4wUga%2Fulorj4z5vgJ6kmSTWjNqk%3D&product=jira); actual installer preview and expected permissions verified | Independent clean-site installation and repeatable setup remain unverified |
| Public source           | Reviewed source published at https://github.com/imshkrsrvstv/waiver-window; fresh extracted validation passed                                                                                                              | Source release 0.1.0 and checksum are public and independently verified                                               |
| Film | [Public YouTube walkthrough](https://youtu.be/YmgVQLZgSYg), 170.526 seconds, actual Jira captures, 51 English subtitle cues published | Native publication, anonymous player readiness and manual English captions verified; audible playback is a separate check |
| Thumbnail               | Original 1440 × 960 design supplied separately                                                                                                                                     | Inspect uploaded crop and rendered project card                                              |
| Final form | Submitted to Codegeist 2026: correct category, no bonus, source/app/install links, thumbnail, 5,537-character story and public video saved | Native Project submitted! confirmation and SUBMITTED TO Codegeist 2026 verified |

Source of the technical snapshot: [test record](TESTING.md) and reviewed release validation. No live result is inferred from a local fixture, successful build, screenshot or manifest entry. Installed-site and external-client results are recorded separately as verification completes.

## Exact demonstration checks

Use fictional Nori Printworks packaging records: SLEEVE-04, revision C, Pune, lots LOT-26-A/B, whole pieces. The film uses 500 allowed, 320 allocated and 180 remaining; the local UI fixture instead begins at 300 with 120 allocated. Never mix those captures into one alleged live sequence.

For a true concurrent demonstration, start both authorized 120/100 requests against the same 180 balance. Preserve both outcomes and one new successful receipt. The remaining amount is 60 if 120 wins, or 80 if 100 wins. Sequential button clicks only show exhaustion; call them sequential. A filmed integration test must be labeled as a live integration test and use the normal permission-aware resolver.

For MCP, record the real client name, requested tool, authorized record identifiers, returned conditions and remaining quantity. Redact account identifiers and tokens. Public fictional permit/job IDs are acceptable. A printed endpoint or a fabricated chat exchange is not evidence.

## Claims and choices to preserve

- **Audience:** supplier-quality and production coordinators already using Jira. No customer validation or willingness-to-pay result yet.
- **Category:** Apps for Specialized Industries. **Bonus:** None currently; external MCP execution is unverified. No Teamwork Graph or Marketplace claim.
- **Mechanism:** exact scope, human authority, one source owner per installation, conditional shared allowance and retained receipts. Say app allowance, not physical inventory or shipment control.
- **Novelty:** a focused combination and interface. Quality Events for Jira, Empower QLM and IFS are established alternatives; absence of a feature in a listing is not proof that it does not exist.
- **Authority:** tools read and explain only; current-user Jira access is checked; project administrators approve/revoke/renew. Never imply an agent approved a permit.
- **Source boundary:** fingerprint covers issue facts and attachment metadata, not attachment bytes. Jira reads and Forge writes are not a cross-system lock.
- **Presentation:** no claim that the editorial preview is a completed demo; no private account details; no stock or synthetic UI standing in for app evidence.
- **Personal statements:** use only the entrant's actual confirmation or feedback. Answer any AI-assistance question truthfully.

## Final link pass

Open the source, setup guide, judge installation, YouTube film and Devpost URLs from the released record. Verify that the installation instructions work for a fresh authorized site rather than relying on the creator's existing tenant. Check the public video's first frame, each actual action/result and closing, then confirm duration and audio. Keep the final Devpost confirmation separate from its public project URL.
