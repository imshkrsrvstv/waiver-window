# Interface dependency review

Reviewed 2026-11-11. Direct packages are pinned: Vite8.3.8 and the official @forge/bridge7.3.0. The interface is plain browser JavaScript/CSS and uses only `invoke` and `router.open` from Forge. No rich-text editor, external font service or analytics is used. Installation used `--ignore-scripts`.

The initial dependency audit reported transitive ProseMirror paste-handling XSS and glob/minimatch denial-of-service issues. Applied exact overrides:

- `prosemirror-view`:1.42.3
- `@forge/manifest` → `glob`:14.0.2
- `glob` → `minimatch`:11.0.1

Inspected Forge manifest's glob call site: `PackageValidator.fileExistsForGlob` uses `await glob(pattern)`, followed by filesystem checks. Verified the patched actual validator against an existing source-file pattern and a missing-file pattern. Production and explicit-demo builds pass. The post-install audit reports zero vulnerabilities. Lockfile retains exact package integrity data.

The production build uses the real Forge bridge. Demo fixtures and reset behavior are removed by the build-time `__LOCAL_DEMO__` flag; missing Forge host access produces an error, never example data. The separately built `dist-demo` bundle is explicitly labeled and is not proof of Forge integration.

Sources:
- https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/invoke/
- https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/router/
- https://github.com/advisories/GHSA-c8x8-7fp4-3x9w
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- https://github.com/advisories/GHSA-g3hv-75wg-m249
