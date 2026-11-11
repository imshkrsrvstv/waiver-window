import { launchBrowser, axePath, baseURL } from "./runtime.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await launchBrowser();
const checks = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.locator("#check-coverage:not([disabled])").waitFor();
  await page.getByText("Source & approval provenance", { exact: true }).click();
  const permitId = await page.locator("#tool-permit-id").inputValue();
  assert(permitId.length > 0);
  assert.equal(
    await page.locator("#tool-job-id").inputValue(),
    await page.locator("#job-select").inputValue(),
  );
  await page
    .getByRole("button", { name: "Copy permit id for tools", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    permitId,
  );
  checks.push(
    "Full permit and selected job IDs are available; copy returns the exact permit ID",
  );
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard permission unavailable");
    };
  });
  await page
    .getByRole("button", {
      name: "Copy selected job id for tools",
      exact: true,
    })
    .click();
  await page
    .getByText("Select and copy this ID with your keyboard or touch menu.", {
      exact: true,
    })
    .waitFor();
  const selection = await page
    .locator("#tool-job-id")
    .evaluate((input) => [
      input.selectionStart,
      input.selectionEnd,
      input.value.length,
    ]);
  assert.deepEqual(selection, [0, selection[2], selection[2]]);
  checks.push(
    "Denied clipboard permission selects the ID and offers manual copy without claiming success",
  );
  for (const theme of ["light", "dark"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
      await page
        .getByRole("button", { name: `Switch to ${theme} theme` })
        .click();
    }
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.addScriptTag({
      path: axePath,
    });
    const result = await page.evaluate(() =>
      axe.run(document.querySelector(".provenance"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    assert.deepEqual(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
  }
  checks.push(
    "Expanded identifiers fit 390px and pass automated accessibility in both themes",
  );
  const result = {
    at: new Date().toISOString(),
    mode: "explicit-local-demo",
    forgeVerified: false,
    checks,
  };
  await writeFile(
    new URL("./artifacts/identifiers.json", import.meta.url),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
