// Renders a built mockup to phone and desktop screenshots and a one-page PDF.
// Usage: node shoot.mjs dist/shady-oaks/index.html OUT_DIR   (needs Playwright; in the cloud sandbox it is already installed)
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(execSync("npm root -g").toString().trim(), "playwright"));
const [page_, out = "mockup"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [name, w, h, scale] of [["phone", 390, 844, 2], ["desktop", 1280, 900, 1]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.goto("file://" + resolve(page_), { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/mockup-${name}.png`, fullPage: true });
  await p.close();
}
const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
await p.goto("file://" + resolve(page_), { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.addStyleTag({ content: ".top{position:static !important} .bar{display:none !important}" });
const h = await p.evaluate(() => document.documentElement.scrollHeight);
await p.pdf({ path: `${out}/mockup.pdf`, width: "1000px", height: h + 4 + "px", printBackground: true, pageRanges: "1" });
await b.close();
console.log("wrote", out);
