import puppeteer from "puppeteer";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Requires the independent memory-only fixture on 5099, never the app server.
const origin = "http://127.0.0.1:5099";
const status = () => fetch(`${origin}/__salary-closing-fixture/status`).then(r => r.json());
assert.equal((await status()).mode, "in-memory only; no auth provider/app server/database");
const initialPdfCount = (await status()).syntheticPdfRequests;
const configure = (path, body) => fetch(`${origin}/__salary-closing-fixture/${path}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.setRequestInterception(true);
page.on("request", request => {
  const u = request.url();
  if (u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:")) request.continue();
  else request.abort();
});
await page.evaluateOnNewDocument(() => {
  window.fixtureBlobs = 0;
  const original = URL.createObjectURL;
  URL.createObjectURL = function(...args) { window.fixtureBlobs++; return original.apply(this, args); };
});
const selector = id => `[data-testid="${id}"]`;
const click = async id => { await page.waitForSelector(selector(id)); await page.click(selector(id)); };
const bankExport = async () => {
  await click("button-export-bank-file");
  await page.$eval(selector("input-bank-due-date"), el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "2026-03-31");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => !document.querySelector('[data-testid="button-confirm-bank-export"]').disabled);
  await click("button-confirm-bank-export");
};
const text = value => page.waitForFunction(s => document.body.innerText.includes(s), {}, value);
const load = async (scenario, width = 1280) => {
  await configure("scenario", { scenario });
  await page.setViewport({ width, height: 900 });
  await page.goto(`${origin}/__salary-closing-fixture?branchId=fixture-branch&month=2026-03`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("5,400"));
};
await mkdir("/tmp/payroll-browser-evidence", { recursive: true });
try {
  await load("membership");
  assert(await page.$eval(selector("button-close-month"), el => el.disabled));
  await page.waitForSelector(selector("payroll-membership-review"));
  for (const id of ["button-export-salary-excel", "button-export-salary-pdf", "button-export-accrued-excel",
    "button-export-accrued-pdf", "button-export-paid-salaries", "button-export-remaining-salaries"]) {
    const before = (await status()).previewRequests;
    await click(id);
    await page.waitForFunction(() => document.body.innerText.includes("الكشف يحتاج مراجعة النقل"));
    assert((await status()).previewRequests > before, id);
    assert.equal(await page.evaluate(() => window.fixtureBlobs), 0, id);
  }
  await bankExport();
  await text("الكشف يحتاج مراجعة النقل");
  assert.equal(await page.evaluate(() => window.fixtureBlobs), 0);
  assert.equal((await status()).syntheticPdfRequests, initialPdfCount);
  await page.screenshot({ path: "/tmp/payroll-browser-evidence/membership-desktop.png" });
  await load("membership", 390);
  await page.waitForSelector(selector("payroll-membership-review"));
  const bounds = await page.$eval(selector("payroll-membership-review"), el => {
    const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, viewport: innerWidth };
  });
  assert(bounds.left >= 0 && bounds.right <= bounds.viewport + 1);
  await page.screenshot({ path: "/tmp/payroll-browser-evidence/membership-mobile.png", fullPage: true });
  await load("clean");
  assert.equal(await page.$eval(selector("button-close-month"), el => el.disabled), false);
  await click("button-export-salary-excel");
  await page.waitForFunction(() => window.fixtureBlobs > 0);
  const blobsBefore = await page.evaluate(() => window.fixtureBlobs);
  await configure("fail-next-previews", { count: 3 });
  await click("button-export-salary-excel");
  await text("لم يتم التصدير");
  assert.equal(await page.evaluate(() => window.fixtureBlobs), blobsBefore, "stale data must not export");
  await load("clean");
  await click("button-export-salary-pdf");
  await page.waitForFunction(() => window.fixtureBlobs > 0);
  assert((await status()).syntheticPdfRequests > 0);
  await load("clean");
  await bankExport();
  await page.waitForFunction(() => window.fixtureBlobs > 0);
  await load("locked");
  assert.equal(await page.$(selector("button-close-month")), null);
  assert.equal(await page.$(selector("payroll-membership-review")), null);
  await click("button-export-salary-excel");
  await page.waitForFunction(() => window.fixtureBlobs > 0);
  await page.screenshot({ path: "/tmp/payroll-browser-evidence/locked-desktop.png" });
  assert.deepEqual((await status()).forbiddenApiWrites, []);
  assert.deepEqual(errors, []);
  console.log("PASS: real payroll page desktop/mobile, warning and close gate, seven blocked exports, stale-refetch protection, clean Excel/PDF/bank exports, locked export, no payroll writes or runtime errors.");
} finally {
  await browser.close();
}