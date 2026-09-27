/**
 * Standalone read-only production workspace using the REAL page and hooks.
 * Serve (for main-agent screenshots): npx tsx tests/production-workspace.browser.fixture.ts --serve
 * Browser assertions: npx tsx tests/production-workspace.browser.fixture.ts --verify
 * No requests reach the application server. Every /api path is intercepted,
 * including unknown paths, and every non-read request is denied.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { kitchens, today, workplan, planning, recipes } from "./fixtures/production-workspace-data";

const app = express();
const requests: string[] = [];
const emptyStats = { total: 0, draft: 0, pending: 0, approved: 0, inProgress: 0, completed: 0, cancelled: 0, daily: 0, weekly: 0, longTerm: 0, totalEstimatedCost: 0 };
const emptyDaily = { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Synthetic-Production-Workspace", "read-only");
  if (req.path.startsWith("/api/")) requests.push(`${req.method} ${req.originalUrl}`);
  if (!["GET", "HEAD"].includes(req.method)) return res.status(405).json({ error: "Synthetic fixture blocks every write" });
  next();
});
app.get("/production-dashboard", (_req, res) => res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${resolve(process.cwd(), "tests/fixtures/production-workspace-entry.tsx")}"></script></body></html>`));
app.get("/api/auth/init", (_req, res) => res.json({
  user: { id: "fixture-manager", username: "fixture-manager", name: "مدير الإنتاج التجريبي", role: "employee", jobTitle: "production_manager", branchId: kitchens[0].id, activeBranchId: kitchens[0].id, allowedBranches: kitchens.map((kitchen, index) => ({ id: index + 1, userId: "fixture-manager", branchId: kitchen.id, accessLevel: "manager", isDefault: index === 0 })) },
  permissions: ["production", "central_kitchen_orders", "central_kitchen_recipes", "daily_production"].map(module => ({ module, actions: ["view", "create", "edit", "approve", "print"] })),
  branches: kitchens,
}));
app.get("/api/auth/me", (_req, res) => res.json({ id: "fixture-manager", role: "employee", branchId: kitchens[0].id, allowedBranches: kitchens.map((kitchen, index) => ({ id: index + 1, branchId: kitchen.id })) }));
app.get("/api/my-permissions", (_req, res) => res.json(["production", "central_kitchen_orders", "central_kitchen_recipes", "daily_production"].map(module => ({ module, actions: ["view", "create", "edit", "approve", "print"] }))));
app.get("/api/branches", (_req, res) => res.json(kitchens));
app.get("/api/central-kitchen-orders/kitchens", (_req, res) => res.json(kitchens));
app.get("/api/central-kitchen-orders/workplan", (req, res) => res.json(workplan(String(req.query.kitchenId || kitchens[0].id), String(req.query.date || today))));
app.get("/api/production/planning", (req, res) => res.json(planning(String(req.query.kitchenId || kitchens[0].id), String(req.query.date || today))));
app.get("/api/central-kitchen-recipes", (req, res) => res.json(recipes(String(req.query.kitchenId || kitchens[0].id))));
app.get("/api/central-kitchen-recipes/catalog", (_req, res) => res.json({ products: recipes(kitchens[0].id).map(recipe => ({ id: recipe.productId, name: recipe.productName, unit: recipe.outputUnit })), materials: [{ id: 8001, name: "دقيق تجريبي", unit: "كيلو" }] }));
app.get("/api/central-kitchen-recipes/import-sources", (_req, res) => res.json({ sources: [] }));
app.get("/api/central-kitchen-orders/operations", (req, res) => res.json({
  runtime: { kitchenId: req.query.kitchenId || kitchens[0].id, mode: "shadow", activatedAt: null, activatedBy: null },
  demands: Array.from({ length: 79 }, (_, i) => ({
    orderId: 400 + Math.floor(i / 3), orderItemId: 1000 + i, orderNumber: `SYNTH-CK-${400 + Math.floor(i / 3)}`,
    requestBranchId: "fixture-branch", requestBranchName: "الفرع التجريبي", orderStatus: "approved",
    neededDate: today, kind: "product", catalogId: 700 + i, catalogInactive: false,
    name: `صنف تجريبي ${String(i + 1).padStart(2, "0")}`, unit: "قطعة",
    targetQuantity: 3, availableQuantity: 0, reservedQuantity: 0, linkedUnfinishedQuantity: 0, uncoveredQuantity: 3,
  })), totals: { byUnit: [] },
}));
app.get("/api/central-kitchen-orders/:id/recipe-exceptions", (_req, res) => res.json({ exceptions: [], canApprove: false }));
app.get("/api/central-kitchen/production/requirements", (_req, res) => res.json({ recipe: null, requirements: [], message: "لا توجد وصفة معتمدة في بيانات الاختبار" }));
app.get("/api/advanced-production-orders/stats", (_req, res) => res.json(emptyStats));
app.get("/api/production/hub", (req, res) => res.json({ today: emptyDaily, yesterday: emptyDaily, deltas: { quantity: 0, batches: 0, quantityPercent: 0, batchesPercent: 0 }, target: { totalTarget: 0, totalProduced: 0, gap: 0, completionRate: 0 }, activeOrders: 0, date: req.query.date || today, branchId: req.query.branchId || kitchens[0].id }));
app.use("/api", (req, res) => res.status(404).json({ error: `No synthetic fixture for ${req.method} ${req.originalUrl}` }));

async function main() {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } }, appType: "spa" });
  app.use(vite.middlewares);
  const port = Number(process.env.PRODUCTION_WORKSPACE_FIXTURE_PORT || 5057);
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
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const url = (tab: string) => `http://127.0.0.1:${port}/production-dashboard?tab=${tab}`;
      const tabs = ["operations", "workplan", "unified-planning", "recipes", "settings-review", "legacy"] as const;
      const names: Record<typeof tabs[number], string> = { operations: "التشغيل الحي", workplan: "خطة العمل", "unified-planning": "التخطيط", recipes: "الوصفات", "settings-review": "الإعدادات", legacy: "السجل والأدوات" };
      for (const width of [1365, 390]) {
        await page.setViewport({ width, height: 900 });
        for (const tab of tabs) {
          await page.goto(url(tab), { waitUntil: "domcontentloaded" });
          try {
            await page.waitForFunction((name: string) => document.querySelector('[role="tab"][data-state="active"]')?.textContent?.includes(name), { timeout: 30000 }, names[tab]);
          } catch (error) {
            console.error("Tab failed", tab, width, await page.evaluate(() => ({ tabs: [...document.querySelectorAll('[role="tab"]')].map(t => [t.textContent, t.getAttribute("data-state")]), body: document.body.innerText.slice(0, 900) })), errors, requests.slice(-12));
            throw error;
          }
          const selector = tab === "operations" ? '[data-testid="operations-demand-row"]' : tab === "recipes" ? ".recipe-row" : tab === "legacy" ? ".desk-content a" : ".pw-row";
          await page.waitForSelector(selector, { timeout: 30000 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${tab} at ${width}px must not horizontally overflow`);
        }
      }
      await page.setViewport({ width: 1365, height: 900 });
      await page.goto(url("operations"), { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 25);
      await page.type('input[aria-label="بحث في الطلبات والأصناف"]', "صنف تجريبي 79");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 1);
      await page.click('input[aria-label="بحث في الطلبات والأصناف"]', { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="operations-demand-row"]').length === 25);
      await page.click('button[aria-label="الصفحة التالية"]');
      await page.waitForFunction(() => document.body.textContent?.includes("2 / 4"));
      const operationsTop = await page.$eval('[data-testid="operations-demand-row"]', el => el.getBoundingClientRect().top);
      await page.$eval('[data-testid="operations-demand-row"] button', button => (button as HTMLButtonElement).click());
      await page.waitForSelector('[role="dialog"]');
      const afterOperationsTop = await page.$eval('[data-testid="operations-demand-row"]', el => el.getBoundingClientRect().top);
      assert(Math.abs(afterOperationsTop - operationsTop) <= 1, "operations dialog does not shift rows");
      await page.keyboard.press("Escape");
      // Search, pagination and modal portals must leave list rows in place.
      for (const tab of ["workplan", "unified-planning", "settings-review", "recipes"]) {
        await page.goto(url(tab), { waitUntil: "domcontentloaded" });
        const row = tab === "recipes" ? ".recipe-row" : ".pw-row";
        const section = tab === "recipes" ? ".recipe-book" : ".planning-workspace";
        await page.waitForSelector(`${section} ${row}`);
        const count = await page.$$eval(`${section} ${row}`, els => els.length);
        assert(count >= 10, `${tab}: populated first page`);
        const first = await page.$eval(`${section} ${row}`, el => el.textContent || "");
        await page.$$eval(`${section} button`, buttons => {
          const next = buttons.find(button => button.textContent?.trim() === "التالي");
          if (!next || next.disabled) throw new Error("Missing enabled next-page button");
          next.click();
        });
        await page.waitForFunction((selector: string, previous: string) => document.querySelector(selector)?.textContent !== previous, {}, `${section} ${row}`, first);
        const search = tab === "recipes" ? 'input[aria-label="البحث باسم المنتج"]' : tab === "workplan" ? "#workplan-search" : tab === "settings-review" ? "#check-search" : "#planning-search";
        const needle = tab === "recipes" ? "وصفة تجريبية 31" : tab === "settings-review" ? "فحص تجريبي 30" : tab === "workplan" ? "FIX-WP-064" : "FIX-PLAN-064";
        await page.type(search, needle);
        await page.waitForFunction((selector: string, value: string) => document.querySelectorAll(selector).length === 1 && document.querySelector(selector)?.textContent?.includes(value), {}, `${section} ${row}`, tab === "recipes" ? "وصفة تجريبية 31" : tab === "settings-review" ? "فحص تجريبي 30" : needle);
        await page.click(search, { clickCount: 3 });
        await page.keyboard.press("Backspace");
        await page.waitForFunction((selector: string, expected: number) => document.querySelectorAll(selector).length === expected, {}, `${section} ${row}`, count);
        const top = await page.$eval(`${section} ${row}`, el => el.getBoundingClientRect().top);
        if (tab === "recipes") await page.$eval(`${section} ${row}`, button => (button as HTMLButtonElement).click());
        else await page.$eval(`${section} ${row} button`, button => (button as HTMLButtonElement).click());
        await page.waitForSelector('[role="dialog"]');
        assert(Math.abs(await page.$eval(`${section} ${row}`, el => el.getBoundingClientRect().top) - top) <= 1, `${tab}: dialog does not shift list rows`);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      }
      await page.goto(url("recipes"), { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".recipe-row");
      await page.evaluate(() => [...document.querySelectorAll(".recipe-book button")].find(button => button.textContent?.includes("مسودة جديدة"))?.click());
      await page.waitForSelector('[role="dialog"] textarea');
      await page.type('[role="dialog"] textarea', "draft survives refresh");
      const refetch = page.waitForResponse(response => response.url().includes("/api/central-kitchen-recipes?kitchenId=") && response.status() >= 200 && response.status() < 400);
      await page.$eval('button[aria-label="تحديث الوصفات"]', button => (button as HTMLButtonElement).click());
      await refetch.catch(error => {
        console.error("recipe refresh diagnostic", requests.filter(request => request.includes("/api/central-kitchen-recipes")), errors);
        throw error;
      });
      await page.waitForFunction(() => (document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement | null)?.value === "draft survives refresh");
      assert.equal(await page.$eval('[role="dialog"] textarea', el => (el as HTMLTextAreaElement).value), "draft survives refresh", "ordinary recipe refetch must not reset editor draft");
      await page.keyboard.press("Escape");
      await page.goto(url("workplan"), { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".planning-workspace .pw-row");
      await page.click(".planning-workspace .pw-row button");
      await page.waitForSelector('[role="dialog"]');
      // A date change is a scope change even while the detail portal is open.
      await page.$eval("#workplan-date", input => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(input, "2035-06-10");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      await page.click("#workplan-kitchen");
      await page.waitForSelector('[role="option"]');
      const kitchenOptions = await page.$$('[role="option"]');
      assert.equal(kitchenOptions.length, 2, "both central kitchens are offered");
      await kitchenOptions[1].click();
      await page.waitForFunction(() => document.querySelector("#workplan-kitchen")?.textContent?.includes("المطبخ المركزي الثاني"));
      assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]') === null), true, "changing kitchen must not retain an old selected dialog");
      assert.deepEqual(errors, [], "no browser runtime errors");
      assert.equal(requests.some(request => !request.startsWith("GET ")), false, "browser journey must never write");
      console.log("Synthetic production workspace: six tabs at 1365px and 390px; search/pagination/dialogs in four lists; recipe draft refetch and scope change; no API writes.");
    } finally { await browser.close(); }
  } finally { close(); }
}
void main();