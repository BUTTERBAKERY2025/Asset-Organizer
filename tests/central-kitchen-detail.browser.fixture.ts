/**
 * Isolated visual fixture for the REAL kitchen-orders page.
 * No production server, database, authentication provider, or write routes.
 * Main agent: KITCHEN_FIXTURE_PORT=5055 npx tsx tests/central-kitchen-detail.browser.fixture.ts --serve
 * Screenshot port 5055, path /central-kitchen-orders?orderId=42&fixtureRole=viewer.
 * Optional isolated browser assertions: same command with --verify instead.
 * Then screenshot /central-kitchen-orders?orderId=42&fixtureRole=viewer
 * (also requester, production, admin; add fixtureDeny=1 for explicit detail denial).
 * Add fixtureCount=75 to exercise paged high-volume list responses.
 * The isolated entry mounts the real page without App's stuck protected
 * Suspense tree. Vite serves current source, so no build is needed.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

type Role = "viewer" | "requester" | "production" | "admin";
const roles = new Set<Role>(["viewer", "requester", "production", "admin"]);
const orderId = 42;
const branch = { id: "fixture-branch", name: "فرع الاختبار", isCentralKitchen: false };
const kitchen = { id: "fixture-kitchen", name: "مطبخ الاختبار", isCentralKitchen: true };
const today = "2026-07-01T09:00:00.000Z";
const requests: string[] = [];

function roleOf(cookie = ""): Role {
  const value = /(?:^|;\s*)fixtureRole=(viewer|requester|production|admin)/.exec(cookie)?.[1] as Role | undefined;
  return value && roles.has(value) ? value : "viewer";
}
function countOf(cookie = "") {
  const requested = Number(/(?:^|;\s*)fixtureCount=(\d+)/.exec(cookie)?.[1] || 1);
  return Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 1;
}

function identity(role: Role) {
  return {
    id: `synthetic-${role}`, username: `synthetic-${role}`, name: `Synthetic ${role}`,
    role: role === "requester" ? "employee" : role === "production" ? "production_development_manager" : role,
    jobTitle: role === "production" ? "production_manager" : role === "requester" ? "branch_manager" : undefined,
    branchId: role === "production" ? kitchen.id : branch.id,
    allowedBranches: [branch, kitchen].map(value => ({ branchId: value.id })),
  };
}

function permissions(role: Role) {
  return [
    { module: "central_kitchen_orders", actions: role === "viewer" ? ["view"] : role === "requester" ? ["view", "edit"] : ["view", "edit", "approve", "print", "export"] },
    ...(role === "production" || role === "admin" ? [{ module: "production", actions: ["view", "edit", "create"] }] : []),
  ];
}

function order(role: Role) {
  return {
    id: orderId, orderNumber: "SYNTHETIC-CK-42", requestBranchId: branch.id, requestBranchName: branch.name,
    centralKitchenId: kitchen.id, centralKitchenName: kitchen.name, inventoryMode: "shadow", status: "approved",
    neededDate: "2026-07-02", neededTime: "12:00", createdAt: today, itemCount: 1,
    items: [{ id: 420, productId: 731, productName: "صنف تجريبي", unit: "قطعة", requestedQuantity: 3, reportedAvailableQuantity: 0 }],
    events: [{ id: 1, eventType: "approved", toStatus: "approved", createdAt: today }],
    linkedBatches: [], allocations: [], shadowInventoryEntries: [],
    allowedActions: { approve: false, prepare: role === "production" || role === "admin", dispatch: false, receive: false, edit: false, cancel: false },
  };
}

async function main() {
  const app = express();
  // Every API response below is synthetic. Unknown endpoints explicitly fail.
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Synthetic-Kitchen-Fixture", "no-live-auth-no-live-writes");
    res.setHeader("Cache-Control", "no-store");
    if (req.path === "/central-kitchen-orders" && req.query.fixtureRole) {
      const role = String(req.query.fixtureRole);
      if (!roles.has(role as Role)) return res.status(400).json({ error: "Unknown synthetic role" });
      res.cookie("fixtureRole", role, { sameSite: "lax" });
      res.cookie("fixtureDeny", req.query.fixtureDeny === "1" ? "1" : "0", { sameSite: "lax" });
      res.cookie("fixtureCount", String(Math.min(100, Math.max(1, Number(req.query.fixtureCount) || 1))), { sameSite: "lax" });
    }
    if (req.path.startsWith("/api/")) requests.push(`${req.method} ${req.path}`);
    if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).json({ error: "Fixture is read-only; no writes exist" });
    next();
  });
  app.get("/central-kitchen-orders", (_req, res) => {
    const entry = resolve(process.cwd(), "tests/fixtures/central-kitchen-detail-entry.tsx");
    const html = readFileSync(resolve(process.cwd(), "tests/fixtures/central-kitchen-detail.html"), "utf8");
    res.type("html").send(html.replace("__FIXTURE_ENTRY__", `/@fs/${entry}`));
  });
  app.get("/__kitchen-fixture/status", (req, res) => res.json({
    role: roleOf(req.headers.cookie), requests, note: "synthetic API, Vite serves actual current client source",
  }));
  app.get("/__kitchen-fixture/revoke", (_req, res) => {
    res.cookie("fixtureDeny", "1", { sameSite: "lax" });
    res.json({ revoked: true, note: "Refresh detail inside the existing browser tab to exercise stale-data denial" });
  });
  app.get("/api/auth/init", (req, res) => {
    const role = roleOf(req.headers.cookie);
    res.json({ user: identity(role), branches: role === "viewer" || role === "requester" ? [branch] : [branch, kitchen], permissions: permissions(role) });
  });
  app.get("/api/auth/me", (req, res) => res.json(identity(roleOf(req.headers.cookie))));
  app.get("/api/my-permissions", (req, res) => res.json(permissions(roleOf(req.headers.cookie))));
  app.get("/api/branches", (req, res) => {
    const role = roleOf(req.headers.cookie);
    res.json(role === "viewer" || role === "requester" ? [branch] : [branch, kitchen]);
  });
  app.get("/api/central-kitchen-orders/policy", (_req, res) => res.json({
    serverNow: today, defaultNeededDate: "2026-07-02", defaultNeededTime: "12:00",
    requestDeadline: "16:00", reviewTime: "17:00",
  }));
  app.get("/api/central-kitchen-orders/catalog-v2", (_req, res) => res.json({
    schemaVersion: 2, items: [{ id: 731, source: "product", name: "صنف تجريبي", unit: "قطعة", sku: "SYNTHETIC-731" }],
  }));
  app.get("/api/central-kitchen-orders/kitchens", (_req, res) => res.json([kitchen]));
  app.get("/api/central-kitchen-orders/:id/recipe-exceptions", (_req, res) => res.json({ exceptions: [], canApprove: false }));
  app.get("/api/central-kitchen-orders/:id/journey", (req, res) => {
    const role = roleOf(req.headers.cookie);
    const production = role === "production" || role === "admin";
    res.json({
      orderId, stages: [{ key: "order", label: "الطلب", status: "complete", summary: "طلب معتمد" }],
      delivery: null, destinationBranchId: branch.id, inventoryProductIds: [731], inventoryMode: "shadow",
      warnings: [], sections: { production, delivery: false, inventory: false, bar: false },
      sectionState: { production: production ? "available" : "restricted", delivery: "restricted", inventory: "restricted", bar: "restricted" },
    });
  });
  app.get("/api/central-kitchen-orders/:id", (req, res) => {
    if (req.headers.cookie?.includes("fixtureDeny=1")) return res.status(403).json({ error: "Synthetic branch authorization revoked" });
    res.json(order(roleOf(req.headers.cookie)));
  });
  app.get("/api/central-kitchen-orders", (req, res) => {
    const count = countOf(req.headers.cookie);
    const pageSize = [25, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 25;
    const page = Math.max(1, Number(req.query.page) || 1);
    const all = Array.from({ length: count }, (_, index) => ({
      ...order(roleOf(req.headers.cookie)),
      id: orderId + index,
      orderNumber: `SYNTHETIC-CK-${String(orderId + index).padStart(3, "0")}`,
      requestBranchName: index % 3 ? `فرع الاختبار ${index + 1}` : branch.name,
      neededDate: `2026-07-${String(index % 28 + 1).padStart(2, "0")}`,
      items: [{ id: 420 + index, productId: 731, productName: `صنف تجريبي ${index + 1}`, unit: "قطعة", requestedQuantity: index % 8 + 1, reportedAvailableQuantity: 0 }],
    }));
    res.json({
      data: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: count, totalPages: Math.ceil(count / pageSize), serverNow: today,
      arrival: { count: 0, maxId: null },
      counts: { attention: 0, requested: 0, approved: count, prepared: 0, dispatched: 0, archive: 0, all: count, new: 0, overdue: 0, dueToday: 0, openDiscrepancies: 0 },
    });
  });
  app.get("/api/*", (req, res) => res.status(404).json({ error: `No synthetic fixture for ${req.path}` }));
  const vite = await createViteServer({
    server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } }, appType: "spa",
  });
  app.use(vite.middlewares);
  const port = Number(process.env.KITCHEN_FIXTURE_PORT || 5000);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const close = () => { server.close(); void vite.close(); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  if (process.argv.includes("--verify")) {
    try {
      const puppeteer = (await import("puppeteer")).default;
      const browser = await puppeteer.launch({
        headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/repl/tools/bin/chromium",
        args: ["--no-sandbox"],
      });
      try {
        const check = async (role: Role) => {
          const context = await browser.createBrowserContext();
          const page = await context.newPage();
          const diagnostics: string[] = [];
          page.on("console", message => diagnostics.push(`console.${message.type()}: ${message.text()}`));
          page.on("pageerror", error => diagnostics.push(`pageerror: ${error.message}`));
          page.on("requestfailed", request => diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`));
          page.on("response", response => {
            if (response.status() >= 400) diagnostics.push(`HTTP ${response.status()} ${response.url()}`);
          });
          await page.setViewport({ width: 1365, height: 900 });
          await page.goto(`http://127.0.0.1:${port}/central-kitchen-orders?orderId=42&fixtureRole=${role}`, { waitUntil: "domcontentloaded" });
          try {
            await page.waitForFunction(() => {
              const detail = document.querySelector(".kitchen-detail-body, [data-testid='kitchen-inline-detail']");
              return detail?.textContent?.includes("صنف تجريبي");
            }, { timeout: 30000 });
          } catch (error) {
            const body = await page.evaluate(() => document.body.textContent?.slice(0, 1600));
            throw new Error(`${role}: real page failed to show item. Visible text: ${body}\nBrowser diagnostics:\n${diagnostics.join("\n")}\n${String(error)}`);
          }
          const production = await page.evaluate(() => document.body.textContent?.includes("الإنتاج والدفعات المرتبطة") || false);
          assert.equal(production, role === "production" || role === "admin", `${role}: production section must follow permission and journey scope`);
          if (role === "production" || role === "admin") {
            assert.equal(await page.evaluate(() => document.body.textContent?.includes("تأكيد التجهيز") || false), true, `${role}: authorized preparation controls`);
            assert.equal(requests.some(path => path === `GET /api/central-kitchen-orders/${orderId}/recipe-exceptions`), true,
              `${role}: linked batches receive server-confirmed production visibility`);
          }
          if (role === "viewer") {
            assert.equal(requests.some(path => /recipe-exceptions|production-fulfillment|central-kitchen\/production|daily-production/.test(path)), false,
              "View-only detail must not issue production-specific API reads");
            await page.evaluate(() => fetch("/__kitchen-fixture/revoke", { credentials: "include" }));
            await page.click('[data-testid="refresh-kitchen-orders"]');
            // The refresh button sits outside the modal and legitimately dismisses it.
            // Reopen the same record: its stale cached result must never render after 403.
            await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
            await page.click('.kitchen-row-number button');
            try {
              await page.waitForFunction(() => document.body.textContent?.includes("لا تملك صلاحية عرض هذا الطلب"), { timeout: 30000 });
            } catch (error) {
              throw new Error(`Denied detail did not render. URL: ${page.url()}; dialogs: ${await page.$$eval('[role="dialog"]', items => items.length)}; Cookie: ${await page.evaluate(() => document.cookie)}; visible: ${(await page.evaluate(() => document.body.innerText)).slice(0, 1900)}; recent requests: ${requests.slice(-12).join(", ")}; ${String(error)}`);
            }
            assert.equal(await page.evaluate(() => document.querySelector(".kitchen-detail-body")?.textContent?.includes("صنف تجريبي") || false), false,
              "A rejected detail refresh must not render the old order");
          }
          await context.close();
        };
        await check("viewer");
        await check("requester");
        await check("production");
        await check("admin");
        const volume = await browser.createBrowserContext();
        try {
          const page = await volume.newPage();
          await page.setViewport({ width: 1920, height: 900 });
          await page.goto(`http://127.0.0.1:${port}/central-kitchen-orders?fixtureRole=production&fixtureCount=75`, { waitUntil: "domcontentloaded" });
          await page.waitForSelector('[data-stage="all"]');
          await page.click('[data-stage="all"]');
          await page.waitForFunction(() => document.querySelectorAll(".kitchen-order-row").length === 25);
          const stableBefore = await page.$eval(".kitchen-order-row:nth-child(3)", element => element.getBoundingClientRect().top);
          await page.hover(".kitchen-order-row .kitchen-row-number button");
          await page.waitForFunction(() => !!document.querySelector(".kitchen-row-popover.is-visible"));
          const stableAfter = await page.$eval(".kitchen-order-row:nth-child(3)", element => element.getBoundingClientRect().top);
          assert.equal(stableAfter, stableBefore, "hover preview must not move subsequent rows");
          assert.equal(await page.$eval(".kitchen-row-popover.is-visible", element => getComputedStyle(element).pointerEvents), "none", "desktop preview must not swallow scrolling/clicks");
          await page.select("#kitchen-page-size", "50");
          await page.waitForFunction(() => document.querySelectorAll(".kitchen-order-row").length === 50);
          assert.equal(await page.evaluate(() => document.body.innerText.includes("من 75 طلب")), true, "filtered total must remain 75 after changing page size");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "1920px workspace must not overflow horizontally");
          await page.click(".kitchen-row-number button");
          await page.waitForSelector('[data-testid="kitchen-inline-detail"]');
          assert.equal(await page.$eval('aside[aria-label="مساحة عمل الطلب المحدد"]', element => element.getBoundingClientRect().width >= 600), true, "wide operations detail needs at least 600px");
          assert.equal(await page.$eval('[data-testid="kitchen-inline-detail"]', element => getComputedStyle(element).overflowY), "auto", "detail must independently scroll");
          await page.click('[aria-label="إغلاق الطلب المحدد"]');
          await page.setViewport({ width: 1536, height: 900 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "1536px split view must not overflow horizontally");
          await page.setViewport({ width: 1365, height: 900 });
          await page.click(".kitchen-row-number button");
          await page.waitForSelector('.kitchen-detail-body');
          assert.equal(await page.$eval('aside[aria-label="مساحة عمل الطلب المحدد"]', element => getComputedStyle(element).display), "none", "narrower desktop must use full dialog rather than a cramped pane");
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
          await page.setViewport({ width: 390, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "mobile queue must not overflow horizontally");
          const heightBefore = await page.$eval(".kitchen-order-row", element => element.getBoundingClientRect().height);
          await page.click(".kitchen-preview-toggle");
          const heightAfter = await page.$eval(".kitchen-order-row", element => element.getBoundingClientRect().height);
          assert.ok(heightAfter > heightBefore, "touch preview expands only on explicit request");
          console.log("Synthetic kitchen fixture: permission scopes, denied detail, 75-order pagination and 1920/1536/mobile layouts verified.");
        } finally {
          await volume.close();
        }
      } finally {
        await browser.close();
      }
    } finally {
      close();
    }
  }
}

void main();