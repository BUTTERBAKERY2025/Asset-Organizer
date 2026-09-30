// Isolated browser contract/layout check. Every API request is intercepted with
// explicitly synthetic evidence; no application database or write endpoint is used.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const port = 5069;
const server = spawn("npx", ["tsx", "tests/warehouse-role.browser.fixture.ts", "--serve"], {
  env: { ...process.env, WAREHOUSE_ROLE_FIXTURE_PORT: String(port) },
  stdio: "ignore", detached: true,
});
const root = `http://127.0.0.1:${port}`;
const kitchen = { id: "synthetic_kitchen", name: "المطبخ المركزي — بيانات اختبار", isCentralKitchen: true };
const day = "2026-09-30";
const item = { id: 41, productId: 7, productName: "كرواسون الزبدة — طلب الفرع الاصطناعي", unit: "قطعة",
  requestedQuantity: 80, preparedQuantity: 60, preparedFromStock: 20, preparedFromProduction: 40,
  dispatchedQuantity: 60, receivedQuantity: 58, damagedQuantity: 1, missingQuantity: 1,
  preparationSourceStatus: "recorded", approvedRecipe: true, catalogMapping: "product" };
const batch = { id: 71, orderItemId: 41, productId: 7, productName: item.productName, unit: "قطعة",
  quantity: 40, finished: true, status: "finished", recipeBacked: true, materialPosting: "consumed",
  directLink: "/central-kitchen-orders?orderId=31" };
const order = { id: 31, orderNumber: "SYNTHETIC-31", neededDate: day, rawStatus: "received",
  source: { requestingBranch: { id: "synthetic_branch", name: "فرع الاختبار" }, kitchen },
  inventoryMode: "real", discrepancyStatus: "open", finished: true, directOrderLink: "/central-kitchen-orders?orderId=31",
  nextStep: { label: "متابعة الفروق والتالف والناقص", owner: "مسؤول الاستلام في الفرع" },
  items: [item], linkedBatches: { batches: [batch] } };
const cohorts = { date: { returned: 1, truncated: false }, overdue: { returned: 0, truncated: false, lookbackDays: 365 } };
const planning = { kitchen, date: day, rows: [
  { key: "central_request:31", source: "central_request", id: 31, number: "SYNTHETIC-31", status: "received",
    date: day, cohort: "date", originLabel: "فرع الاختبار", inventoryMode: "real",
    directLink: "/central-kitchen-orders?orderId=31", issues: [], items: [{ ...item, plannedQuantity: 80, completedQuantity: 40, inProgressQuantity: 0, remainingQuantity: null, issues: [] }] },
  { key: "advanced_plan:51", source: "advanced_plan", id: 51, number: "PLAN-SYNTHETIC-51", status: "in_progress",
    date: day, cohort: "date", originLabel: kitchen.name, inventoryMode: null, directLink: "/advanced-production-orders/51",
    issues: [], items: [{ ...item, id: 61, plannedQuantity: 40, completedQuantity: 40, inProgressQuantity: 0, remainingQuantity: 0, issues: [],
      requestLink: { requestItemId: 41, requestOrderId: 31, allocatedQuantity: 40 } }] },
], checks: [], summary: { bySource: { central_request: { date: 1, overdue: 0 }, advanced_plan: { date: 1, overdue: 0 } } },
  metadata: { generatedAt: `${day}T09:00:00Z`, actualRiyadhToday: day, configuration: { inventoryMode: "real" },
    truncated: false, rowLimitPerSourceAndCohort: 250, cohorts: { central_request: cohorts, advanced_plan: cohorts },
    coverage: { status: "calculated", complete: true, scope: "all_open_eligible_requests_current_state", candidateCount: 1, candidateLimit: 250, note: "بيانات اختبار فقط" } } };
const user = { id: "synthetic_production_manager", username: "synthetic", name: "اختبار الإنتاج", role: "admin", branchId: kitchen.id };
const permissions = ["production", "central_kitchen_orders", "warehouse", "daily_production", "advanced_production_orders"].map(module => ({ module, actions: ["view", "create", "edit"] }));
let denyRaw = false;
let browser;
try {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(`${root}/production-dashboard?role=admin`)).ok) break; } catch {}
    if (attempt === 149) throw new Error("Synthetic fixture failed to become ready");
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  browser = await puppeteer.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return request.continue();
    if (request.method() !== "GET") return request.respond({ status: 405, body: "Synthetic fixture forbids writes" });
    let data = [];
    let status = 200;
    if (url.pathname === "/api/auth/init") data = { user, permissions, branches: [kitchen] };
    else if (url.pathname === "/api/auth/me") data = user;
    else if (url.pathname === "/api/my-permissions") data = permissions;
    else if (url.pathname === "/api/branches") data = [kitchen];
    else if (url.pathname === "/api/central-kitchen-orders/kitchens") data = [kitchen];
    else if (url.pathname === "/api/production/planning") data = planning;
    else if (url.pathname === "/api/central-kitchen-orders/workplan") data = { kitchen, date: day, orders: [order], overdueEarlierOrders: [] };
    else if (url.pathname === "/api/central-kitchen-orders/operations") data = { runtime: { kitchenId: kitchen.id, mode: "real" }, demands: [], totals: { byUnit: [] } };
    else if (url.pathname === "/api/warehouse/material-transfers") {
      status = denyRaw ? 403 : 200;
      data = denyRaw ? { error: "Synthetic revoked permission" } : [{ id: 11, transferNumber: "RAW-SYNTHETIC-11", status: "in_transit",
        destinationBranchId: kitchen.id, sourceBranchName: "المستودع الرئيسي", createdAt: `${day}T07:00:00Z` }];
    } else if (url.pathname === "/api/kitchen-warehouse-shipping") {
      assert.equal(url.searchParams.get("kitchenId"), kitchen.id);
      data = [{ id: 21, shipment_number: "SHIP-SYNTHETIC-21", status: "dispatched", source_branch_id: kitchen.id, destination_name: "المستودع الفرعي", created_at: `${day}T08:00:00Z` }];
    } else if (url.pathname === "/api/reverse-logistics") {
      assert.equal(url.searchParams.get("kitchenId"), kitchen.id);
      data = [{ id: 81, kind: "product_return", status: "received", source_branch_id: "synthetic_branch", destination_branch_id: kitchen.id, quarantine_quantity: "2", shortage_quantity: "1", created_at: `${day}T10:00:00Z` }];
    } else if (url.pathname.includes("count")) data = { count: 0, unreadCount: 0 };
    return request.respond({ status, contentType: "application/json", body: JSON.stringify(data) });
  });
  await mkdir("screenshots", { recursive: true });
  for (const width of [1365, 390]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${root}/production-dashboard?role=admin&kitchenId=${kitchen.id}&date=${day}`, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.body.innerText.includes("SYNTHETIC-31"));
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      direction: getComputedStyle(document.querySelector('section[aria-label="دورة الإنتاج الموحدة"]')).direction,
      links: [...document.querySelectorAll('section[aria-label="دورة الإنتاج الموحدة"] a[href]')].map(a => a.getAttribute("href")),
    }));
    assert.equal(result.overflow, false, JSON.stringify(result));
    assert.equal(result.direction, "rtl");
    for (const reference of ["transferId=11", "shipmentId=21", "movementId=81", "orderId=31", "/advanced-production-orders/51"])
      assert(result.links.some(href => href.includes(reference)), `Missing exact record link ${reference}`);
    await page.screenshot({ path: `screenshots/production-cycle-${width}.png`, fullPage: true });
    await page.screenshot({ path: `screenshots/production-cycle-${width}-viewport.png` });
    console.log(JSON.stringify({ width, overflow: result.overflow, verifiedLinks: 5, errors }));
  }
  denyRaw = true;
  await page.evaluate(() => [...document.querySelectorAll("button")].find(button => button.textContent.includes("تحديث جميع المسارات"))?.click());
  await page.waitForFunction(() => document.body.innerText.includes("غير مصرح بعرض هذا المسار"));
  assert.equal(await page.evaluate(() => document.body.innerText.includes("RAW-SYNTHETIC-11")), false);
  assert.equal(await page.evaluate(() => document.body.innerText.includes("SYNTHETIC-31")), true);
  await page.screenshot({ path: "screenshots/production-cycle-390-denied.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS synthetic desktop/mobile, exact references and revoked-permission cached-data suppression");
} finally {
  await browser?.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
}