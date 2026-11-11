# Waiver Window interface

The interface is a focused approval desk: the human-approved exception stays beside the job being checked, and the finite allowance remains visible above both. Porcelain, ink, oxidized copper and a measured amber ruler give the product its own industrial identity. See `../../docs/DESIGN.md` for the visual rationale.

## Build modes

```sh
npm ci --ignore-scripts
npm run build
```

The production output is `dist/`, the resource referenced by the Forge manifest. It uses the official Forge bridge. Open it through the installed Jira app. Missing Forge host access produces an error; production never substitutes example records.

```sh
npm run dev
```

The development address is `http://127.0.0.1:4351/`. This command deliberately enables **Local demo** mode, which is visibly labeled. The fictional packaging records stay in this browser's local storage. They are not Jira records, real approval authority, or evidence of Forge connectivity. **Reset demo** clears only these local fixtures. `npm run build:demo` creates the separate `dist-demo/` directory; do not deploy it as the Forge resource.

## Working flow

1. Create an exception linked to a Jira work item. Record exact supplier, part, revision, plant, allowed lots, units, quantity and effective window.
2. An authorized reviewer explicitly approves the scope. Drafts cannot cover jobs.
3. Create or select a job, then check coverage. Each condition exposes the expected value, actual value and reason.
4. If every required condition passes, explicitly allocate its quantity. The server rechecks the facts and records a receipt.
5. Open **Allocation history** to inspect or download receipts. Cancellation restores the app allowance once and retains history.

Active allocations prevent scope changes. Title-only edits preserve approval. If the source work item changes, coverage stops; after cancelling active allocations, an authorized reviewer can inspect the current source and explicitly renew approval. Historical receipts preserve the earlier source snapshot. Revoked approvals cannot be renewed.

These are app allocations, not physical inventory or shipment controls.

## Security and presentation

- All business operations pass through the envelope in `../../docs/CONTRACT.md`. The server owns authorization, actors, trusted source fingerprints, validation and concurrency.
- Dynamic text is escaped before rendering. Jira links use the Forge router and validated work item keys.
- The theme initializes synchronously from a same-origin external file, respects the system preference initially, and remembers an explicit choice.
- Dynamic ruler widths use individual DOM style properties. Strict `script-src 'self'` and `style-src 'self'` work without inline-script or inline-style exceptions.
- Native dialogs, visible focus, reduced-motion support and responsive layouts cover both complete themes.
- No external fonts, analytics or runtime model calls are used by the interface.

## Verification

Local results are saved in `qa/artifacts/` and explicitly record `forgeVerified: false` where applicable. They do not certify the deployed backend.

- `browser.mjs`: 13 critical journeys, including allocation, mismatch, cancellation, revocation, title-only edits, explicit draft approval, stale-source renewal and narrow screens.
- `accessibility.mjs`: eight states across light/dark, desktop/mobile and coverage/dialogs; zero automated WCAG violations.
- `production.mjs`: five build and strict-CSP checks, including fixture exclusion, missing-host failure and exact ruler geometry.
- `source-binding.mjs`: alternative drafts cannot approve the same source, and revocation retains its original owner.
- `cancelled-retry.mjs`: a retry of a cancelled request shows its historical receipt and explicitly reports that no new allocation was made.
- `identifiers.mjs`: exact clipboard values, a manual-copy fallback when clipboard access is blocked, and expanded provenance accessibility at mobile width in both themes.

The isolated `qa/package.json` pins Playwright and axe-core. Install it with `npm --prefix qa ci --ignore-scripts`. Use an installed browser through `QA_BROWSER_EXECUTABLE_PATH`, or install Playwright Chromium explicitly. See `qa/README.md` for portable setup. Start the demo development server before running the journey, accessibility and identifier scripts. The production check starts its own temporary local server and requires both builds.

```sh
node qa/browser.mjs
node qa/accessibility.mjs
node qa/identifiers.mjs
node qa/cancelled-retry.mjs
node qa/source-binding.mjs
npm run build
npm run build:demo
node qa/production.mjs
```

Package versions and the zero-finding dependency audit are documented in `DEPENDENCIES.md`. Screenshots accompany the local journey report. Live Jira integration and installation verification belong to the platform deployment record.
