import { launchBrowser, baseURL } from "./runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await launchBrowser();
const requestId = "11111111-2222-4333-8444-555555555555";
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((id) => {
    crypto.randomUUID = () => id;
  }, requestId);
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.locator("#check-coverage:not([disabled])").waitFor();
  await page.evaluate((id) => {
    const data = JSON.parse(localStorage.getItem("ww-local-demo-v3"));
    const prior = data.reservations[0];
    data.reservations.push({
      ...prior,
      id: "cancelled-retry-receipt",
      jobId: "job-PACK-211",
      jobFingerprint: "job-PACK-211-v1",
      requestId: id,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    localStorage.setItem("ww-local-demo-v3", JSON.stringify(data));
  }, requestId);
  await page.reload();
  await page.locator("#check-coverage:not([disabled])").waitFor();
  await page.locator("#check-coverage").click();
  await page.locator("#reserve:not([disabled])").waitFor();
  await page.locator("#reserve").click();
  await page.locator('#reserve-form input[type="checkbox"]').check();
  await page
    .getByRole("button", { name: "Confirm allocation", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Allocation receipt", exact: true })
    .waitFor();
  assert.match(
    await page.locator(".notice").textContent(),
    /already cancelled\. No new allocation was made/,
  );
  assert.equal(await page.locator(".remaining strong").textContent(), "180");
  assert.match(await page.locator("dialog .badge").textContent(), /Cancelled/);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ww-local-demo-v3")),
  );
  assert.equal(stored.reservations.length, 2);
  assert.equal(stored.waivers[0].allocatedQuantity, 120);
  const result = {
    at: new Date().toISOString(),
    mode: "explicit-local-demo",
    forgeVerified: false,
    checks: [
      "Cancelled historical retry displays a no-new-allocation message and the cancelled receipt",
      "Existing allowance and reservation count remain unchanged",
    ],
  };
  await mkdir(new URL("./artifacts/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("./artifacts/cancelled-retry.json", import.meta.url),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
