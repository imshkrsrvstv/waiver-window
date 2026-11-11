import { chromium } from "playwright";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const baseURL = process.env.QA_BASE_URL || "http://127.0.0.1:4351";
export const axePath = require.resolve("axe-core/axe.min.js");
export function launchBrowser() {
  const executablePath = process.env.QA_BROWSER_EXECUTABLE_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}
