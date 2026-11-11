# Demonstration guide

The film follows one coherent story: **problem → solution and real walkthrough → closing**. Target length is approximately 3 minutes 54 seconds, with a hard delivery ceiling below five minutes. The current storyboard is a production plan; live footage and external MCP results are not yet attached.

This guide is the self-contained replay and film plan. Never relabel the local demo as an installed Jira app.

## One fictional case

A packaging coordinator has a human-approved exception for a cosmetic print-tone variation on gift sleeves. These are fictional, noncritical records, unrelated to real customers or shipments.

| Field                        | Value                                      |
| ---------------------------- | ------------------------------------------ |
| Supplier                     | Nori Printworks                            |
| Part / revision              | SLEEVE-04 / C                              |
| Plant                        | Pune                                       |
| Allowed lots                 | LOT-26-A and LOT-26-B                      |
| Unit                         | pieces                                     |
| Total allowance              | 500                                        |
| Earlier job allocation       | 320                                        |
| Remaining before the contest | 180                                        |
| Job A                        | 120 pieces; exact matching scope; LOT-26-A |
| Job B                        | 100 pieces; exact matching scope; LOT-26-B |
| Mismatch job                 | 80 pieces; Chennai plant; otherwise matching  |

Choose actual accessible Jira issue keys during setup. Never paste illustrative keys as though they exist. Set the effective time before capture and expiry sufficiently after capture, record both in the scenario manifest, and keep dates unchanged during the story. The app displays local time and stores precise timestamps.

## Prepare the live workspace

1. Install the production or approved development build and open Waiver Window inside an existing Jira project authorized for fictional tests.
2. Create a source issue describing the fictional exception and four job issues: prior allocation, A, B and mismatch. These are ordinary Jira issues the app can read; it does not silently create them.
3. Create the exception through the app with exact fields and a 500-piece limit. Review it as a project administrator, then explicitly approve it.
4. Create the earlier 320-piece job, check it and allocate it. Refresh: the ruler should show 320 allocated and 180 available. Preserve its receipt.
5. Create jobs A, B and the mismatch job. Copy their full IDs and the permit ID from the collapsed provenance panel into the private capture manifest. Public fictional record IDs may appear in the film; credentials and account identifiers may not.
6. Rehearse camera positions without allocating the competing jobs. Capture the real allocation attempt only when the evidence recorder is ready.

## The concurrency moment

Both A and B should initially pass coverage because each asks for fewer than 180 pieces. Their combined request is 220, so both must not allocate.

To prove a race, dispatch two authorized `reserve` requests with distinct stable request IDs at overlapping times against the same live allowance. Use the ordinary authenticated Forge path. Preserve start/end timestamps, both full result envelopes, canonical final balance and the new receipt count. A test harness may orchestrate the calls; label that shot **Live integration test**, followed by the actual app showing the result.

Sequential native-browser clicks demonstrate ordinary capacity enforcement, not concurrency. If only that capture is available, narrate it as sequential allocation and place the separately verified local race in a clearly labeled engineering-test appendix. Do not splice two successes from different states into one apparent run.

| Real result            | Expected final state                               |
| ---------------------- | -------------------------------------------------- |
| A's 120 succeeds first | 440 allocated, 60 available; B cannot allocate 100 |
| B's 100 succeeds first | 420 allocated, 80 available; A cannot allocate 120 |

The film must follow the observed winner. Do not force a 60-piece ending if the real run leaves 80. Retry the successful request with its original ID only if a live retry mechanism is available; verify the same receipt and unchanged balance. The normal UI preventing a second allocation is useful but does not by itself prove request-ID idempotency.

## Walkthrough after the conflict

- Open the successful allocation receipt. Keep quantity, scope and source details readable. Frame or redact personal actor identifiers consistently in the published footage; do not fabricate different receipt facts.
- Check the mismatch job. Open the plant condition and show required Pune versus actual Chennai. A different plant fails even when quantity is available.
- Demonstrate a real source edit only in the fictional project. Recheck and show that prior approval no longer yields coverage. Active allocations must be cancelled before an administrator can review and renew the same scope. Earlier receipts retain their original source snapshot.
- Future-only MCP validation plan (not selected for the current entry): connect an actual authorized client and invoke the read-only coverage tool with the copied permit/job IDs. Capture the tool result and its explanation. A model asking to “approve anyway” must have no mutation tool to invoke. The tool set is a technical boundary; a polite refusal sentence alone is not proof.

If the source-renewal sequence makes the film too long, show the source-change result and explain the human review requirement. Keep the complete renewal walkthrough in written instructions. If MCP connectivity is still pending, omit that live claim from the film and do not select the bonus until a real invocation is verified.

## Judge replay

The public installation link must work before these become final judge instructions. A Jira administrator installs the app; a project administrator approves the fictional exception; a user with job edit permission allocates. Use the setup steps above on the judge's own accessible project. The project page supports inspection; issue-panel visibility also depends on Jira's issue editing context.

The app's ordinary workflow needs no external API keys. Optional agent access needs Rovo availability, administrator tool enablement and client consent. Full setup is in [DEPLOYMENT.md](DEPLOYMENT.md). Read-only tools take existing app IDs, which can be copied from provenance; they do not search for or invent a permit.

## Film quality requirements

- Compose a constant 1920×1080 output at 30 fps. Capture each app clip at a fixed 1600×900 viewport. Never resize the browser mid-shot.
- Establish the full desk, then use restrained close-ups around 1.25–1.45× on a condition, quantity or confirmation. Measure actual control bounds after capture; do not invent camera coordinates now.
- Use porcelain, ink, oxidized copper and brass. The opening uses two job requests competing for one visible allowance, rather than a generic animated dashboard.
- Prefer natural synthetic narration with measured pauses. Check “Waiver Window,” “Jira,” “Rovo,” and every quantity by listening to the final audio. No purchased voice, cloned identity or music is needed.
- Provide subtitles. Inspect encoded footage for blank bands, clipping, legible text, uninterrupted action order, transitions and phone-sized playback. Audio analysis alone is not a listening review.
- Label editorial diagrams separately from actual app evidence. Do not publish account menus, emails, tokens, browser history or private issue content.
