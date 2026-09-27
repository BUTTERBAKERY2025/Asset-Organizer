/**
 * Read-only synthetic fixture mounting the REAL operations board. No live APIs.
 * Serve: npx tsx tests/central-kitchen-operations.browser.fixture.ts --serve
 * Open: http://127.0.0.1:5056/production-dashboard?tab=operations
 * Verify: npx tsx tests/central-kitchen-operations.browser.fixture.ts --verify
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import assert from "node:assert/strict";
import { resolve } from "node:path";

const app = express();
const requests: string[] = [];
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Synthetic-Operations", "read-only");
  if (req.path.startsWith("/api/")) requests.push(`${req.method} ${req.path}`);
  if (!["GET", "HEAD"].includes(req.method)) return res.status(405).json({ error: "Synthetic fixture blocks all writes" });
  next();
});
app.get("/production-dashboard", (_req, res) => res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${resolve(process.cwd(), "tests/fixtures/central-kitchen-operations-entry.tsx")}"></script></body></html>`));
app.get("/api/auth/init", (_req, res) => res.json({
  user: { id: "synthetic-operator", role: "employee", jobTitle: "production_manager", branchId: "fixture-kitchen", name: "مشغل تجريبي" },
  permissions: [{ module: "production", actions: ["view", "create"] }], kitchens: [{ id: "fixture-kitchen", name: "المطبخ المركزي التجريبي" }],
}));
app.get("/api/auth/me", (_req, res) => res.json({ id: "synthetic-operator", role: "employee", branchId: "fixture-kitchen" }));
app.get("/api/my-permissions", (_req, res) => res.json([{ module: "production", actions: ["view", "create"] }]));
app.get("/api/central-kitchen-orders/operations", (_req, res) => res.json({
  runtime: { kitchenId: "fixture-kitchen", mode: "shadow", activatedAt: null, activatedBy: null },
  demands: Array.from({ length: 79 }, (_, i) => ({
    orderId: 400 + Math.floor(i / 3), orderItemId: 1000 + i, orderNumber: `SYNTH-CK-${400 + Math.floor(i / 3)}`,
    requestBranchId: `fixture-branch-${i % 4 + 1}`, requestBranchName: `فرع تجريبي ${i % 4 + 1}`, orderStatus: "approved",
    neededDate: `2026-07-${String(i % 28 + 1).padStart(2, "0")}`,
    kind: i % 9 === 0 ? "warehouse" : "product", catalogId: 700 + i, catalogInactive: i % 13 === 0,
    name: `صنف تجريبي ${String(i + 1).padStart(2, "0")}`, unit: i % 2 ? "كيلو" : "قطعة",
    targetQuantity: i % 2 ? .5 : 3, availableQuantity: 0, reservedQuantity: 0,
    linkedUnfinishedQuantity: i % 5 === 0 ? 1 : 0, uncoveredQuantity: i % 4 === 0 ? 0 : i % 2 ? .5 : 3,
  })),
  totals: { byUnit: [] },
}));
app.get("/api/central-kitchen-orders/:id/recipe-exceptions", (_req, res) => res.json({ exceptions: [], canApprove: false }));
app.get("/api/central-kitchen/production/requirements", (_req, res) => res.json({ recipe: null, requirements: [], message: "لا توجد وصفة معتمدة في بيانات الاختبار" }));
app.get("/api/*", (req, res) => res.status(404).json({ error: `No fixture for ${req.path}` }));

async function main() {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } }, appType: "spa" });
  app.use(vite.middlewares);
  const port = Number(process.env.OPERATIONS_FIXTURE_PORT || 5056);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  const close = () => { server.close(); void vite.close(); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
  if (!process.argv.includes("--verify")) return;
  try {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      page.on("pageerror", error => console.error("fixture page error:", error.message));
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 900 });
        await page.goto(`http://127.0.0.1:${port}/production-dashboard?tab=operations`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 25, { timeout: 30000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}px must not horizontally overflow`);
        const top = await page.$eval('[data-testid="operations-demand-row"]', el => el.getBoundingClientRect().top);
        await page.click('[data-testid="operations-demand-row"] button');
        await page.waitForSelector('[role="dialog"]');
        assert.equal(await page.$eval('[data-testid="operations-demand-row"]', el => el.getBoundingClientRect().top), top, "details do not expand the row");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      }
      await page.type('input[aria-label="بحث في الطلبات والأصناف"]', "صنف تجريبي 78");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 1);
      await page.click('input[aria-label="بحث في الطلبات والأصناف"]', { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 25);
      await page.click('[aria-label="تصفية الحالة"]');
      await page.waitForSelector('[role="option"]');
      for (const option of await page.$$('[role="option"]')) {
        if ((await option.evaluate(el => el.textContent))?.includes("تحتاج تغطية")) { await option.click(); break; }
      }
      await page.waitForFunction(() => document.querySelector('[aria-label="تصفية الحالة"]')?.textContent?.includes("تحتاج تغطية") && [...document.querySelectorAll('[data-testid="operations-demand-row"]')].every(el => !el.textContent?.includes("مغطّى")));
      await page.click('[aria-label="تصفية الوحدة"]');
      await page.waitForSelector('[role="option"]');
      for (const option of await page.$$('[role="option"]')) {
        if ((await option.evaluate(el => el.textContent))?.includes("كيلو")) { await option.click(); break; }
      }
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="operations-demand-row"]')].every(el => el.textContent?.includes("كيلو")));
      await page.evaluate(() => {
        const clear = [...document.querySelectorAll("button")].find(el => el.textContent?.includes("مسح الفلاتر"));
        clear?.click();
      });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 25 && document.body.textContent?.includes("1 / 4"));
      await page.click('button[aria-label="الصفحة التالية"]');
      await page.waitForFunction(() => document.body.textContent?.includes("2 / 4"));
      await page.click('button[aria-label="الصفحة السابقة"]');
      await page.waitForFunction(() => document.body.textContent?.includes("1 / 4"));
      for (const row of await page.$$('[data-testid="operations-demand-row"]')) {
        const text = await row.evaluate(el => el.textContent || "");
        if (text.includes("تحتاج تغطية") && !text.includes("غير مفعّل") && text.includes("منتج كتالوج")) {
          await row.$eval("button", button => button.click());
          break;
        }
      }
      await page.waitForSelector('[role="dialog"]');
      const start = await page.$$('[role="dialog"] button');
      for (const button of start) {
        if ((await button.evaluate(el => el.textContent))?.includes("بدء إنتاج")) { await button.click(); break; }
      }
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(el => el.textContent?.includes("إنشاء الدفعة")));
      const qtyInput = 'input[type="number"]';
      await page.waitForSelector(qtyInput, { visible: true });
      await new Promise(resolve => setTimeout(resolve, 350));
      await page.click(qtyInput, { clickCount: 3 });
      await page.type(qtyInput, "2");
      await page.setViewport({ width: 1440, height: 900 });
      assert.equal(await page.$eval(qtyInput, input => (input as HTMLInputElement).value), "2", "production draft remains intact across responsive layout");
      await page.keyboard.press("Escape");
      assert.equal(requests.some(request => !request.startsWith("GET ")), false, "search, pagination and detail must never write");
      console.log("Synthetic operations fixture: 79 lines; desktop/mobile overflow, stable details, search/filter/pagination, draft retention verified; no writes.");
    } finally { await browser.close(); }
  } finally { close(); }
}
void main();