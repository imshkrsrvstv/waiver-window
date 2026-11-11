import { launchBrowser } from "./runtime.mjs";
import { createServer } from "node:http";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";
import assert from "node:assert/strict";

const app = fileURLToPath(new URL("../", import.meta.url));
const checks = [];
const cspErrors = [];
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const mode = url.pathname.startsWith("/demo/") ? "dist-demo" : "dist";
  const relative =
    url.pathname.replace(/^\/(demo|production)\//, "") || "index.html";
  if (relative.includes("..")) {
    res.writeHead(400).end();
    return;
  }
  try {
    const body = await readFile(join(app, mode, relative));
    res.writeHead(200, {
      "Content-Type": types[extname(relative)] || "application/octet-stream",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (/Content Security Policy|violates.*directive/i.test(message.text()))
      cspErrors.push(message.text());
  });
  await page.goto(`${origin}/production/`);
  await page
    .getByRole("heading", { name: "The workspace could not open." })
    .waitFor();
  assert.equal(await page.locator(".demo-strip").count(), 0);
  assert.equal(await page.locator("#waiver-select").count(), 0);
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  checks.push(
    "Production without a Forge host fails closed with no local example records",
  );
  checks.push(
    "Synchronous external theme bootstrap honors system dark mode under strict CSP",
  );
  const bundles = await readdir(join(app, "dist/assets"));
  assert.equal(
    bundles.some((name) => name.includes("demo-adapter")),
    false,
  );
  for (const file of bundles.filter((name) => name.endsWith(".js"))) {
    const content = await readFile(join(app, "dist/assets", file), "utf8");
    assert(
      !content.includes("ww-local-demo-v3") &&
        !content.includes("Nori Printworks"),
    );
  }
  checks.push(
    "Production bundles exclude the fixture adapter and fixture data",
  );
  await page.goto(`${origin}/demo/`);
  await page
    .getByRole("heading", { name: "Scope before allocation." })
    .waitFor();
  const fills = await page.locator(".allocation-ruler").evaluate((element) => ({
    total: element.getBoundingClientRect().width,
    allocated: element.querySelector(".ruler-fill").getBoundingClientRect()
      .width,
    proposed: element.querySelector(".ruler-preview").getBoundingClientRect()
      .width,
  }));
  assert(Math.abs(fills.allocated / fills.total - 0.4) < 0.01);
  assert(Math.abs(fills.proposed / fills.total - 0.4) < 0.01);
  checks.push(
    "Allocation ruler paints exact quantities through DOM style properties under strict CSP",
  );
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Scope before allocation." })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.deepEqual(cspErrors, []);
  checks.push(
    "Explicit theme persists and no script or style CSP violations occur",
  );
  const result = {
    at: new Date().toISOString(),
    forgeVerified: false,
    checks,
    cspErrors,
  };
  await writeFile(
    new URL("./artifacts/production.json", import.meta.url),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
