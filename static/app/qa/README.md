# Browser verification

This isolated package pins Playwright 1.58.2 and axe-core 4.10.3. It is not included in the production interface bundle. Install without lifecycle scripts:

```sh
npm ci --ignore-scripts
```

Use an existing compatible browser through `QA_BROWSER_EXECUTABLE_PATH`, or install the Playwright Chromium browser explicitly with `npx playwright install chromium`. The harness never downloads a browser automatically. `QA_BASE_URL` defaults to `http://127.0.0.1:4351` and can select a different local demo address.

Start the app's explicit demo server, build production and demo resources, then run this package's `npm test`. The scripts use standard package imports and `runtime.mjs`; no temporary workspace paths are required.

```sh
# From static/app, in another terminal:
npm run dev
npm run build
npm run build:demo

# From static/app/qa:
npm test
```

The suite covers critical user journeys, light/dark accessibility, tool-identifier copying and its permission fallback, honest cancelled-retry messaging, permanent source ownership after first approval, fixture exclusion and strict CSP behavior. It writes generated results under `artifacts/`. Results use fictional local state and do not prove live Jira integration.

Dependency installation used pinned packages and `--ignore-scripts`; npm reported zero vulnerabilities on 11 November 2026. Playwright is Apache-2.0; axe-core is MPL-2.0. The lockfile preserves exact package integrity metadata. The browser itself is supplied separately and may need local operating-system dependencies or permission to run.
