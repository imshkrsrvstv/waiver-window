import { launchBrowser, baseURL } from "./runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const out = fileURLToPath(new URL("./artifacts/", import.meta.url));
await mkdir(out, { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
async function ready() {
  await page
    .getByRole("heading", { name: "Scope before allocation." })
    .waitFor();
  await page.locator("#check-coverage:not([disabled])").waitFor();
}
async function screenshot(name) {
  await page.screenshot({
    path: out + name + ".png",
    fullPage: !(await page.locator("dialog[open]").count()),
  });
}
try {
  await page.goto(baseURL);
  await ready();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await ready();
  assert.equal(await page.locator("#reserve").isDisabled(), true);
  checks.push("Allocation stays disabled before coverage check");
  await screenshot("light-desktop");
  await page
    .getByRole("button", { name: "Check coverage", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "This job fits the window." })
    .waitFor();
  assert.equal(await page.locator("#reserve").isEnabled(), true);
  checks.push("Matching job enables explicit allocation only after check");
  await screenshot("light-coverage");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await screenshot("dark-coverage");
  await page.reload();
  await ready();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  checks.push("Explicit dark theme survives reload");
  await page.locator("#job-select").selectOption("job-PACK-213");
  await page
    .getByRole("button", { name: "Check coverage", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "This job is outside the window." })
    .waitFor();
  assert.equal(await page.locator("#reserve").isDisabled(), true);
  checks.push("Plant mismatch blocks allocation");
  await screenshot("dark-mismatch");
  await page.locator("#job-select").selectOption("job-PACK-211");
  await page.getByRole("button", { name: "Edit scope", exact: true }).click();
  const form = page.locator("#waiver-form");
  assert.equal(
    await form.locator("[name=supplier]").getAttribute("readonly"),
    "",
  );
  await form
    .getByLabel("Exception title", { exact: true })
    .fill("Gift sleeve print-tone variation — title updated");
  await form.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Gift sleeve print-tone variation — title updated",
    })
    .waitFor();
  assert.ok(await page.locator(".badge.approved").count());
  checks.push("Title-only edit with active allocations preserves approval");
  await page
    .getByRole("button", { name: "Check coverage", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "This job fits the window." })
    .waitFor();
  await page.locator("#reserve").click();
  const allocation = page.locator("#reserve-form");
  await screenshot("dark-confirmation");
  assert.equal(
    await allocation.locator("input[type=checkbox]").isChecked(),
    false,
  );
  await allocation.locator("input[type=checkbox]").check();
  await allocation
    .getByRole("button", { name: "Confirm allocation", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Allocation receipt", exact: true })
    .waitFor();
  assert.ok(
    await page
      .locator(".receipt-sheet")
      .textContent()
      .then((t) => t.includes("120")),
  );
  await screenshot("dark-receipt");
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.equal(await page.locator(".remaining strong").textContent(), "60");
  assert.equal(await page.locator("#reserve").isDisabled(), true);
  checks.push(
    "Allocation records receipt, reduces balance to60, prevents repeat allocation",
  );
  await page
    .getByRole("button", { name: "View allocation receipt", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Allocation receipt", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Cancel allocation", exact: true })
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Fictional job postponed; restore its app allowance.");
  await page
    .getByRole("button", { name: "Cancel allocation", exact: true })
    .click();
  await page
    .getByText("Allocation cancelled. Its allowance was restored once.", {
      exact: true,
    })
    .waitFor();
  await ready();
  assert.equal(await page.locator(".remaining strong").textContent(), "180");
  checks.push("Cancellation restores allowance and retains historical receipt");
  await page
    .getByRole("button", { name: "Allocation history", exact: true })
    .click();
  assert.ok(await page.getByText("Cancelled", { exact: true }).count());
  await screenshot("dark-history");
  await page
    .getByRole("button", { name: "Coverage desk", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revoke approval", exact: true })
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Demonstration source approval withdrawn.");
  await page
    .locator("#reason-form")
    .getByRole("button", { name: "Revoke approval", exact: true })
    .click();
  await page
    .getByText("Approval revoked. New allocations are no longer covered.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Check coverage", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "This job is outside the window." })
    .waitFor();
  assert.equal(await page.locator("#reserve").isDisabled(), true);
  checks.push("Revocation stops further allocation");
  await page
    .getByRole("button", { name: "New exception", exact: true })
    .click();
  const draft = page.locator("#waiver-form");
  for (const [name, v] of Object.entries({
    title: "Fictional sleeve finish exception",
    sourceIssueKey: "PACK-301",
    supplier: "Nori Printworks",
    part: "SLEEVE-05",
    revision: "A",
    plant: "Pune",
    lots: "LOT-TEST-1",
    quantityLimit: "200",
  }))
    await draft.locator(`[name=${name}]`).fill(v);
  await draft.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("heading", { name: "Fictional sleeve finish exception" })
    .waitFor();
  await page
    .getByRole("button", { name: "Review & approve", exact: true })
    .click();
  await page.locator("#approve-form input[type=checkbox]").check();
  await page
    .getByRole("button", { name: "Approve exception", exact: true })
    .click();
  await page
    .getByText(
      "The exact scope is approved. Jobs still need an individual coverage check.",
      { exact: true },
    )
    .waitFor();
  checks.push("New source-linked draft requires explicit human approval");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await ready();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("dark-mobile");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .getByRole("button", { name: "Check coverage", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "This job fits the window." })
    .waitFor();
  await screenshot("dark-mobile-coverage");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot("light-mobile-coverage");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks.push("390px light/dark coverage has no horizontal page overflow");
  await page.setViewportSize({ width: 320, height: 740 });
  await page
    .getByRole("button", { name: "New exception", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await screenshot("light-320-dialog");
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(await page.locator("dialog").count(), 0);
  checks.push("320px form fits and Escape closes native modal");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await ready();
  await page.evaluate(() => {
    const key = "ww-local-demo-v3";
    const data = JSON.parse(localStorage.getItem(key));
    data.sources["PACK-104"] = "demo-source-PACK104-v2";
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await ready();
  await page.locator("#check-coverage").click();
  await page.getByRole("heading", { name: "A source needs review." }).waitFor();
  assert.equal(await page.locator("#renew-approval").count(), 0);
  await page
    .getByText(
      "Cancel active allocations before reviewing and renewing approval.",
      { exact: true },
    )
    .waitFor();
  checks.push(
    "Changed source blocks coverage and requires cancellation before renewal",
  );
  await page
    .getByRole("button", { name: "Allocation history", exact: true })
    .click();
  await page.getByRole("button", { name: "View receipt", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel allocation", exact: true })
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Source changed; cancel the earlier allocation before review.");
  await page
    .locator("#reason-form")
    .getByRole("button", { name: "Cancel allocation", exact: true })
    .click();
  await page
    .getByText("Allocation cancelled. Its allowance was restored once.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Coverage desk", exact: true })
    .click();
  await ready();
  await page.locator("#check-coverage").click();
  await page.locator("#renew-approval").waitFor();
  await screenshot("light-source-review");
  await page.locator("#renew-approval").click();
  await page.locator("#renew-form input[type=checkbox]").check();
  await page
    .locator("#renew-form")
    .getByRole("button", { name: "Renew approval", exact: true })
    .click();
  await page
    .getByText(
      "Approval renewed against the current source. Check job coverage again.",
      { exact: true },
    )
    .waitFor();
  await ready();
  await page.locator("#check-coverage").click();
  await page
    .getByRole("heading", { name: "This job fits the window." })
    .waitFor();
  checks.push(
    "Source renewal needs explicit confirmation and restores coverage only after recheck",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        mode: "explicit-local-demo",
        forgeVerified: false,
        checks,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      forgeVerified: false,
      artifacts: out,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
