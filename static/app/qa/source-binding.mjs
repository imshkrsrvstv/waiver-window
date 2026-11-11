import { launchBrowser, baseURL } from "./runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.locator("#check-coverage:not([disabled])").waitFor();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("ww-local-demo-v3"));
    data.waivers.unshift({
      ...data.waivers[0],
      id: "alternative-draft",
      title: "Alternative draft using the same source",
      status: "draft",
      allocatedQuantity: 0,
      approvedAt: null,
      approvedBy: null,
    });
    localStorage.setItem("ww-local-demo-v3", JSON.stringify(data));
  });
  await page.reload();
  await page.locator("#check-coverage:not([disabled])").waitFor();
  async function attemptAlternative() {
    await page.locator("#waiver-select").selectOption("alternative-draft");
    await page.locator("#approve-waiver").click();
    assert.match(
      await page.locator("#approve-form .form-callout").textContent(),
      /permanently links PACK-104/,
    );
    await page.locator('#approve-form input[type="checkbox"]').check();
    await page
      .getByRole("button", { name: "Approve exception", exact: true })
      .click();
    await page.locator("#approve-form .form-error:not([hidden])").waitFor();
    assert.match(
      await page.locator("#approve-form .form-error").textContent(),
      /already assigned to another exception/,
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await attemptAlternative();
  await page.locator("#waiver-select").selectOption("demo-waiver-01");
  await page.locator("#revoke-waiver").click();
  await page
    .locator('dialog textarea[name="reason"]')
    .fill("Fictional workflow review");
  await page.locator('dialog button[type="submit"]').click();
  await page.locator(".permit .badge.revoked").waitFor();
  await page.locator("#check-coverage:not([disabled])").waitFor();
  await attemptAlternative();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ww-local-demo-v3")),
  );
  assert.equal(stored.sourceBindings["PACK:PACK-104"], "demo-waiver-01");
  assert.equal(
    stored.waivers.find((w) => w.id === "alternative-draft").status,
    "draft",
  );
  const result = {
    at: new Date().toISOString(),
    mode: "explicit-local-demo",
    forgeVerified: false,
    checks: [
      "Alternative draft cannot approve a source already bound to another exception",
      "Approval dialog explains the permanent source link",
      "Revocation retains the original source binding and the alternative remains a draft",
    ],
  };
  await mkdir(new URL("./artifacts/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("./artifacts/source-binding.json", import.meta.url),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
