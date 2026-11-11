import { launchBrowser, axePath, baseURL } from "./runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const out = fileURLToPath(new URL("./artifacts/", import.meta.url));
await mkdir(out, { recursive: true });
const browser = await launchBrowser();
const findings = [];
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto(baseURL);
      await page.locator("#check-coverage:not([disabled])").waitFor();
      await page.locator("#check-coverage").click();
      await page.locator("#coverage-result").waitFor();
      await page.addScriptTag({
        path: axePath,
      });
      for (const mode of ["coverage", "dialog"]) {
        if (mode === "dialog") {
          await page.locator("#reserve").click();
          await page.locator("dialog").waitFor();
        }
        const result = await page.evaluate(async () => {
          const r = await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          });
          return r.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          }));
        });
        findings.push({ theme, width, mode, violations: result });
      }
      await context.close();
    }
  await writeFile(
    out + "accessibility.json",
    JSON.stringify(
      { at: new Date().toISOString(), mode: "explicit-local-demo", findings },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(findings));
  assert.equal(findings.flatMap((f) => f.violations).length, 0);
} finally {
  await browser.close();
}
