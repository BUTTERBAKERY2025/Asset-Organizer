import type { Express, Request } from "express";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import {
  branches, maintenanceTickets, centralKitchenOrders, materialTransfers, reverseMovements,
  leaveRequests, advanceRequests, qualityChecks, branchDailyClosures, cashierSalesJournals,
  branchShifts, timesheetReports,
  attendanceRecords,
} from "@shared/schema";
import { qualityPassRate, deduplicateOperationsQueue, validateOperationsBranches, availableCardMetrics, makeOperationsQueueItem as queueItem } from "@shared/operations-center";
import { noticeInSelectedScope, publicCenterNotice } from "@shared/operations-center-notifications";
import type { OperationsCenterResponse, OperationsMetric, OperationsQueueItem, OperationsEvidenceDay } from "@shared/operations-center";
import { db } from "./db";
import { pool } from "./db";
import { storage } from "./storage";
import { activeDeliveryStatuses } from "@shared/delivery";
import { canAccessDeliveryWorkspace } from "@shared/delivery-workspace-access";
import { getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";
import { branchOperationsDefinitions, hasEffectiveViewPermission, loadAuthorizedBranchOperationsCard } from "./branch-operations";

const MAX_BRANCHES = 30;
const SOURCE_LIMIT = 101;
const PAGE_LIMIT = 100;
const CARD_CONCURRENCY = 6;
const SOURCE_CONCURRENCY = 4;
const PERMISSION_CONCURRENCY = 6;
const dateInRiyadh = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
const asIso = (value: Date | string | null | undefined) => value ? new Date(value).toISOString() : null;
const link = (path: string, branchId: string) => `${path}${path.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`;

/** Bounded workers preserve input order, including when tasks finish out of order. */
export async function mapOperationsBounded<T, R>(items: readonly T[], limit: number, load: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await load(items[index]);
    }
  }));
  return results;
}

function notificationBranches(req: Request): string[] {
  const input = req.query.branchIds;
  // Unlike the board, notifications never interpret an omitted scope as "all".
  if (typeof input !== "string") throw Object.assign(new Error("Select branchIds explicitly"), { status: 400 });
  const ids = input.split(",").map(id => id.trim());
  if (!ids.length || ids.length > MAX_BRANCHES || ids.some(id => !id || id === "all") || new Set(ids).size !== ids.length)
    throw Object.assign(new Error("Invalid branchIds"), { status: 400 });
  return ids;
}

async function selectedNotifications(req: Request) {
  const ids = notificationBranches(req);
  const allowed = getAllowedBranchIds(req);
  if (allowed !== null && ids.some(id => !allowed.includes(id)))
    throw Object.assign(new Error("Branch scope denied"), { status: 403 });
  const existing = await db.select({ id: branches.id }).from(branches).where(inArray(branches.id, ids));
  if (!validateOperationsBranches(ids, allowed, existing.map(row => row.id)))
    throw Object.assign(new Error("Branch scope denied or branch does not exist"), { status: 403 });
  const userId = req.currentUser!.id;
  const notifications = await storage.getActiveNotificationsForUserInBranches(userId, ids);
  const visible = new Map<number, NonNullable<ReturnType<typeof noticeInSelectedScope>> & { notification: (typeof notifications)[number] }>();
  for (const notification of notifications) {
    const scope = noticeInSelectedScope(notification, ids);
    if (scope) visible.set(notification.id, { ...scope, notification });
  }
  return Array.from(visible.values()).sort((a, b) =>
    b.notification.priority - a.notification.priority ||
    +new Date(b.notification.createdAt) - +new Date(a.notification.createdAt) ||
    b.notification.id - a.notification.id);
}

function notificationError(res: any, next: any, error: any) {
  if (error?.status === 400 || error?.status === 403) return res.status(error.status).json({ message: error.message });
  return next(error);
}

/** All returned sources are restricted by BOTH branch scope and their own view grant.
 * Per-source failure is reported as unavailable, never silently converted to zero. */
export async function projectOperationsCenter(req: Request, requested: string[] | "all", offset: number, exportMode = false): Promise<OperationsCenterResponse> {
  const allowed = getAllowedBranchIds(req);
  const branchRows = await db.select({ id: branches.id, name: branches.name }).from(branches)
    .where(requested === "all"
      ? allowed === null ? undefined : allowed.length ? inArray(branches.id, allowed) : sql`false`
      : inArray(branches.id, requested))
    .orderBy(branches.id).limit(MAX_BRANCHES + 1);
  if (branchRows.length > MAX_BRANCHES) throw Object.assign(new Error(`Maximum ${MAX_BRANCHES} branches per request; select branchIds`), { status: 400 });
  if (!validateOperationsBranches(requested, allowed, branchRows.map(r => r.id)))
    throw Object.assign(new Error("Branch scope denied or branch does not exist"), { status: 403 });
  const branchIds = branchRows.map(row => row.id);
  if (!branchIds.length) throw Object.assign(new Error("No accessible branches"), { status: 403 });
  const now = new Date();
  const generatedAt = now.toISOString();
  const businessDate = dateInRiyadh(now);
  const dates = Array.from({ length: 7 }, (_, i) => dateInRiyadh(new Date(now.getTime() - (6 - i) * 86400000)));
  const permitted = async (module: string) => await hasEffectiveViewPermission(req, module)
    && (!exportMode || await hasEffectiveViewPermission(req, module, "export"));
  const grants = new Map<string, boolean>();
  const modules = [...new Set([...branchOperationsDefinitions.map(d => d.module), "quality_control", "hr_leaves", "hr_advances", "warehouse", "shifts", "cashier_journal", "delivery_tasks", "attendance"])];
  const permissions = await mapOperationsBounded(modules, PERMISSION_CONCURRENCY, permitted);
  modules.forEach((module, index) => grants.set(module, permissions[index]));
  const enabled = (module: string) => grants.get(module) === true;
  const cardTasks = branchIds.flatMap(branchId => branchOperationsDefinitions.map(definition => ({ branchId, definition })))
    .filter(({ definition }) => enabled(definition.module));
  const cards = (await mapOperationsBounded(cardTasks, CARD_CONCURRENCY, async ({ branchId, definition }) => {
    if (!enabled(definition.module)) return null;
    const card = await loadAuthorizedBranchOperationsCard(definition, branchId, businessDate, req);
    if (!card) return null;
    return {
      ...card, branchId, module: definition.module, error: card.state === "error" ? "Source unavailable" : undefined,
      metrics: card.metrics.map((metric, index): OperationsMetric => ({
        key: `${definition.id}.${index}`, label: metric.label, value: metric.value,
        unit: metric.unit, source: definition.module, definition: card.description || metric.label,
        period: definition.id === "attendance" || definition.id === "sales" || definition.id === "waste" ? businessDate : "current",
        scope: [branchId], asOf: generatedAt, coverage: "complete",
      })),
    };
  })).filter((card): card is NonNullable<typeof card> => card !== null);
  const queue: OperationsQueueItem[] = [];
  const coverage: Record<string, "complete" | "unavailable"> = {};
  let truncated = false;
  const sources: { name: string; load: () => Promise<OperationsQueueItem[]> }[] = [];
  function source(name: string, module: string, load: () => Promise<OperationsQueueItem[]>) {
    if (!enabled(module)) return;
    sources.push({ name, load });
  }
  async function loadSource({ name, load }: (typeof sources)[number]) {
    try {
      const rows = await load();
      return { name, rows };
    } catch (error) {
      console.error(`Operations center source ${name} unavailable`, error);
      return { name, rows: [] as OperationsQueueItem[], failed: true };
    }
  }
  source("maintenance", "maintenance", async () => {
    const rows = await db.select({ id: maintenanceTickets.id, branchId: maintenanceTickets.branchId, status: maintenanceTickets.status,
      assignee: maintenanceTickets.assigneeUserId, due: maintenanceTickets.dueAt })
      .from(maintenanceTickets).where(and(inArray(maintenanceTickets.branchId, branchIds),
        inArray(maintenanceTickets.status, ["open", "assigned", "in_progress"]))).orderBy(desc(maintenanceTickets.createdAt)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("maintenance", r.id, r.status, r.branchId, "maintenance", "بلاغ صيانة", r.status, link("/maintenance", r.branchId), r.assignee || "غير محدد", asIso(r.due), r.assignee));
  });
  source("kitchen", "central_kitchen_orders", async () => {
    const rows = await db.select({ id: centralKitchenOrders.id, branchId: centralKitchenOrders.requestBranchId,
      status: centralKitchenOrders.status }).from(centralKitchenOrders)
      .where(and(inArray(centralKitchenOrders.requestBranchId, branchIds),
        inArray(centralKitchenOrders.status, ["requested", "approved", "prepared", "dispatched"])))
      .orderBy(desc(centralKitchenOrders.createdAt)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("kitchen_order", r.id, r.status, r.branchId, "central_kitchen_orders", "طلب مطبخ",
      r.status, link(`/central-kitchen-orders?stage=${r.status}`, r.branchId), r.status === "dispatched" ? "الفرع المستلم" : "المطبخ المورد"));
  });
  source("transfers", "warehouse", async () => {
    const rows = await db.select({ id: materialTransfers.id, source: materialTransfers.sourceBranchId,
      destination: materialTransfers.destinationBranchId, status: materialTransfers.status }).from(materialTransfers)
      .where(and(or(inArray(materialTransfers.sourceBranchId, branchIds), inArray(materialTransfers.destinationBranchId, branchIds)),
        inArray(materialTransfers.status, ["pending", "approved", "in_transit"])))
      .orderBy(desc(materialTransfers.id)).limit(SOURCE_LIMIT);
    return rows.flatMap(r => [r.source, r.destination].filter((id): id is string => !!id && branchIds.includes(id))
      .map(id => queueItem("transfer", r.id, r.status, id, "warehouse", "تحويل مواد", r.status,
        link(`/transfer-requests?status=${r.status}`, id), r.status === "in_transit" ? "الفرع المستلم" : "جهة التوريد")));
  });
  source("reverse", "warehouse", async () => {
    const rows = await db.select({ id: reverseMovements.id, source: reverseMovements.sourceBranchId,
      destination: reverseMovements.destinationBranchId, status: reverseMovements.status }).from(reverseMovements)
      .where(or(inArray(reverseMovements.sourceBranchId, branchIds), inArray(reverseMovements.destinationBranchId, branchIds)))
      .orderBy(desc(reverseMovements.id)).limit(SOURCE_LIMIT);
    return rows.filter(r => !["cancelled", "closed", "received", "completed"].includes(r.status))
      .flatMap(r => [r.source, r.destination].filter((id): id is string => !!id && branchIds.includes(id))
        .map(id => queueItem("reverse_movement", r.id, r.status, id, "warehouse", "حركة مرتجعات", r.status, link("/reverse-logistics", id))));
  });
  source("delivery", "delivery_tasks", async () => {
    if (!canAccessDeliveryWorkspace(req.currentUser)) {
      coverage.delivery = "unavailable";
      return [];
    }
    // Only sources with their own view (and export for exports) are included.
    const types = [
      ...(enabled("central_kitchen_orders") ? ["kitchen"] : []),
      ...(enabled("warehouse") ? ["material_transfer", "reverse_movement"] : []),
    ];
    if (!types.length) return [];
    const result = await pool.query<{
      id: number; source_type: string; status: string; driver_id: string | null;
      branch_id: string;
    }>(`SELECT a.id, a.source_type, a.status, a.driver_id,
      COALESCE(k.request_branch_id,mt.destination_branch_id,rm.destination_branch_id) AS branch_id
      FROM delivery_assignments a
      LEFT JOIN central_kitchen_orders k ON a.source_type='kitchen' AND a.source_id=k.id
      LEFT JOIN material_transfers mt ON a.source_type='material_transfer' AND a.source_id=mt.id
      LEFT JOIN reverse_movements rm ON a.source_type='reverse_movement' AND a.source_id=rm.id
      WHERE a.source_type = ANY($1::text[]) AND a.status = ANY($2::text[])
        AND COALESCE(k.request_branch_id,mt.destination_branch_id,rm.destination_branch_id) = ANY($3::varchar[])
      ORDER BY a.id DESC LIMIT $4`, [types, activeDeliveryStatuses, branchIds, SOURCE_LIMIT]);
    return result.rows.map(r => queueItem("delivery_assignment", r.id, r.status, r.branch_id, "delivery_tasks",
      "مهمة توصيل", r.status, link("/driver-deliveries", r.branch_id), r.driver_id || "غير محدد", null, r.driver_id));
  });
  source("leaves", "hr_leaves", async () => {
    const rows = await db.select({ id: leaveRequests.id, branchId: leaveRequests.branchId, status: leaveRequests.status,
      level: leaveRequests.currentLevel }).from(leaveRequests)
      .where(and(inArray(leaveRequests.branchId, branchIds), eq(leaveRequests.status, "pending")))
      .orderBy(desc(leaveRequests.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("leave", r.id, `level_${r.level}`, r.branchId, "hr_leaves", "طلب إجازة",
      r.status, link("/hr/leaves", r.branchId)));
  });
  source("attendance", "attendance", async () => {
    const rows = await db.select({ id: attendanceRecords.id, branchId: attendanceRecords.branchId,
      status: attendanceRecords.status }).from(attendanceRecords)
      .where(and(inArray(attendanceRecords.branchId, branchIds), eq(attendanceRecords.attendanceDate, businessDate),
        eq(attendanceRecords.status, "pending")))
      .orderBy(desc(attendanceRecords.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("attendance_record", r.id, "pending", r.branchId, "attendance",
      "سجل حضور قيد المراجعة", r.status,
      link(`/employee-attendance-report?startDate=${businessDate}&endDate=${businessDate}`, r.branchId)));
  });
  source("advances", "hr_advances", async () => {
    const rows = await db.select({ id: advanceRequests.id, branchId: advanceRequests.branchId,
      status: advanceRequests.status }).from(advanceRequests)
      .where(and(inArray(advanceRequests.branchId, branchIds),
        inArray(advanceRequests.status, ["pending", "pre_approved", "awaiting_signature", "signed"])))
      .orderBy(desc(advanceRequests.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("advance", r.id, r.status, r.branchId, "hr_advances", "طلب سلفة", r.status,
      link("/hr/advances", r.branchId), r.status === "awaiting_signature" ? "الموظف" : r.status === "pending" ? "مدير التشغيل" : "شؤون الموظفين"));
  });
  source("quality", "quality_control", async () => {
    const rows = await db.select({ id: qualityChecks.id, branchId: qualityChecks.branchId, result: qualityChecks.result })
      .from(qualityChecks).where(and(inArray(qualityChecks.branchId, branchIds), eq(qualityChecks.checkDate, businessDate),
        inArray(qualityChecks.result, ["failed", "needs_improvement"])))
      .orderBy(desc(qualityChecks.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("quality_check", r.id, r.result, r.branchId, "quality_control", "فحص جودة يحتاج متابعة",
      r.result, link("/quality-control", r.branchId)));
  });
  source("journals", "cashier_journal", async () => {
    const user = req.currentUser!;
    const allCashiers = ["admin", "manager"].includes(user.role)
      || await storage.hasPermission(user.id, "cashier_performance", "approve")
      || await storage.hasPermission(user.id, "cashier_journal", "approve");
    const actor = allCashiers ? undefined : eq(cashierSalesJournals.cashierId, user.id);
    const rows = await db.select({ id: cashierSalesJournals.id, branchId: cashierSalesJournals.branchId,
      status: cashierSalesJournals.status, cashier: cashierSalesJournals.cashierId }).from(cashierSalesJournals)
      .where(and(inArray(cashierSalesJournals.branchId, branchIds), lte(cashierSalesJournals.journalDate, businessDate),
        inArray(cashierSalesJournals.status, ["draft", "submitted", "rejected"]), actor))
      .orderBy(desc(cashierSalesJournals.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("cashier_journal", r.id, r.status, r.branchId, "cashier_journal", "يومية كاشير",
      r.status, link(`/cashier-journals?status=${r.status}`, r.branchId), r.status === "submitted" ? "المراجع المخول" : r.cashier,
      null, r.status === "submitted" ? null : r.cashier));
  });
  source("closing", "daily_closures", async () => {
    const rows = await db.select({ id: branchDailyClosures.id, branchId: branchDailyClosures.branchId,
      status: branchDailyClosures.status, date: branchDailyClosures.closureDate }).from(branchDailyClosures)
      .where(and(inArray(branchDailyClosures.branchId, branchIds), lte(branchDailyClosures.closureDate, businessDate),
        eq(branchDailyClosures.status, "open"))).orderBy(desc(branchDailyClosures.id)).limit(SOURCE_LIMIT);
    return rows.map(r => queueItem("daily_closure", r.id, "open", r.branchId, "daily_closures", "إغلاق يومي غير مكتمل",
      r.status, link(`/branch-daily-closing?date=${encodeURIComponent(r.date)}&from=branch-operations`, r.branchId)));
  });
  for (const result of await mapOperationsBounded(sources, SOURCE_CONCURRENCY, loadSource)) {
    if (result.failed) { coverage[result.name] = "unavailable"; continue; }
    if (result.rows.length >= SOURCE_LIMIT) truncated = true;
    queue.push(...result.rows.slice(0, SOURCE_LIMIT - 1));
    // The delivery loader can mark itself unavailable despite a module grant.
    if (coverage[result.name] !== "unavailable") coverage[result.name] = "complete";
  }
  // Daily evidence is queried at its historical date, never inferred from today's counters.
  const daily: OperationsEvidenceDay[] = [];
  for (const branchId of branchIds) {
    for (const date of dates) daily.push({ date, branchId, opening: "unavailable",
      closing: enabled("daily_closures") ? "not_recorded" : "unavailable", journalCount: null, source: [] });
  }
  if (enabled("shifts")) {
    try {
      const rows = await db.select({ branchId: branchShifts.branchId, date: branchShifts.shiftDate,
        opened: branchShifts.openingCompleted }).from(branchShifts)
        .where(and(inArray(branchShifts.branchId, branchIds), gte(branchShifts.shiftDate, dates[0]), lte(branchShifts.shiftDate, businessDate)));
      for (const row of rows) {
        const day = daily.find(d => d.branchId === row.branchId && d.date === row.date);
        if (day && row.opened) { day.opening = "recorded"; day.source.push("branch_shifts.opening_completed"); }
      }
    } catch (error) { console.error("Opening evidence unavailable", error); }
  }
  if (enabled("daily_closures")) {
    try {
      const rows = await db.select({ branchId: branchDailyClosures.branchId, date: branchDailyClosures.closureDate,
        status: branchDailyClosures.status }).from(branchDailyClosures)
        .where(and(inArray(branchDailyClosures.branchId, branchIds), gte(branchDailyClosures.closureDate, dates[0]), lte(branchDailyClosures.closureDate, businessDate)));
      for (const row of rows) {
        const day = daily.find(d => d.branchId === row.branchId && d.date === row.date);
        if (day) { day.closing = row.status === "closed" ? "closed" : "incomplete"; day.source.push("branch_daily_closures"); }
      }
    } catch (error) {
      console.error("Closing evidence unavailable", error);
      for (const day of daily) day.closing = "unavailable";
    }
  }
  if (enabled("cashier_journal")) {
    try {
      const user = req.currentUser!;
      const allCashiers = ["admin", "manager"].includes(user.role)
        || await storage.hasPermission(user.id, "cashier_performance", "approve")
        || await storage.hasPermission(user.id, "cashier_journal", "approve");
      const rows = await db.select({ branchId: cashierSalesJournals.branchId, date: cashierSalesJournals.journalDate,
        id: cashierSalesJournals.id }).from(cashierSalesJournals)
        .where(and(inArray(cashierSalesJournals.branchId, branchIds), gte(cashierSalesJournals.journalDate, dates[0]),
          lte(cashierSalesJournals.journalDate, businessDate),
          allCashiers ? undefined : eq(cashierSalesJournals.cashierId, user.id)));
      for (const day of daily) {
        day.journalCount = rows.filter(r => r.branchId === day.branchId && r.date === day.date).length;
        day.source.push("cashier_sales_journals");
      }
    } catch (error) { console.error("Journal evidence unavailable", error); }
  }
  const sorted = deduplicateOperationsQueue(queue).sort((a, b) => a.id.localeCompare(b.id));
  const page = sorted.slice(offset, offset + PAGE_LIMIT);
  const metrics: OperationsMetric[] = availableCardMetrics(cards);
  if (enabled("quality_control")) {
    try {
      const checks = await db.select({ branchId: qualityChecks.branchId, result: qualityChecks.result })
        .from(qualityChecks).where(and(inArray(qualityChecks.branchId, branchIds), eq(qualityChecks.checkDate, businessDate)));
      for (const id of branchIds) {
        const rows = checks.filter(r => r.branchId === id);
        metrics.push({ key: "quality.pass_rate", label: "نسبة فحوص الجودة الناجحة", value: qualityPassRate(rows.map(r => r.result)),
          unit: "%", source: "quality_checks", definition: "عدد الفحوص الناجحة / جميع الفحوص المسجلة لليوم؛ بلا فحوص لا توجد نسبة",
          period: businessDate, scope: [id], asOf: generatedAt, coverage: rows.length ? "complete" : "unavailable" });
      }
    } catch (error) {
      console.error("Quality denominator unavailable", error);
      for (const id of branchIds) metrics.push({ key: "quality.pass_rate", label: "نسبة فحوص الجودة الناجحة",
        value: null, unit: "%", source: "quality_checks", definition: "عدد الفحوص الناجحة / جميع الفحوص المسجلة لليوم",
        period: businessDate, scope: [id], asOf: generatedAt, coverage: "unavailable" });
    }
  }
  if (enabled("attendance")) {
    try {
      const reports = await db.select({ branchId: timesheetReports.branchId, status: timesheetReports.status,
        endDate: timesheetReports.endDate }).from(timesheetReports)
        .where(and(inArray(timesheetReports.branchId, branchIds), gte(timesheetReports.endDate, dates[0]), lte(timesheetReports.endDate, businessDate)));
      for (const id of branchIds) metrics.push({ key: "timesheet.finalized", label: "تقارير الدوام النهائية (ليست جاهزية رواتب)", value: reports.filter(r => r.branchId === id && r.status === "finalized").length,
        source: "timesheet_reports", definition: "تقارير دوام نهائية ضمن آخر 7 أيام فقط؛ لا يؤكد اكتمال الرواتب أو جميع الموظفين", period: `${dates[0]}/${businessDate}`,
        scope: [id], asOf: generatedAt, coverage: "partial" });
    } catch (error) {
      console.error("Timesheet readiness unavailable", error);
      for (const id of branchIds) metrics.push({ key: "timesheet.finalized", label: "تقارير الدوام النهائية (ليست جاهزية رواتب)",
        value: null, source: "timesheet_reports", definition: "تقارير دوام نهائية خلال آخر 7 أيام فقط؛ المصدر غير متاح",
        period: `${dates[0]}/${businessDate}`, scope: [id], asOf: generatedAt, coverage: "unavailable" });
    }
  }
  return {
    generatedAt, businessDate, scope: { branchIds, requested, limit: PAGE_LIMIT }, branches: branchRows,
    modules: [...grants].filter(([, value]) => value).map(([name]) => name), cards, metrics, queue: page, daily,
    weekly: [{ startDate: dates[0], endDate: businessDate, recordedClosings: daily.filter(d => d.closing === "closed").length,
      recordedJournals: enabled("cashier_journal") && daily.every(d => d.journalCount !== null)
        ? daily.reduce((sum, d) => sum + (d.journalCount || 0), 0) : null, coverage: "partial" }],
    coverage: { queue: coverage, truncated: truncated || sorted.length > offset + PAGE_LIMIT,
      nextOffset: sorted.length > offset + PAGE_LIMIT ? offset + PAGE_LIMIT : null },
  };
}

export function registerOperationsCenterRoutes(app: Express): void {
  const auth = [isAuthenticated, requirePermission("operations", "view")] as const;
  app.get("/api/operations-center/notifications", ...auth, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const rows = await selectedNotifications(req);
      const reads = new Set((await storage.getNotificationReadsByUser(req.currentUser!.id)).map(read => read.notificationId));
      return res.json(rows.map(({ notification, kind, branchIds }) =>
        publicCenterNotice(notification, { kind, branchIds }, reads.has(notification.id))));
    } catch (error) { return notificationError(res, next, error); }
  });
  app.post("/api/operations-center/notifications/:id/:action", ...auth, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      if (req.params.action !== "read" && req.params.action !== "dismiss")
        return res.status(400).json({ message: "Invalid notification action" });
      if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))
        return res.status(400).json({ message: "Invalid notification ID" });
      const id = Number(req.params.id);
      // Re-evaluate recipient, live workflow authorization and exact selected
      // branch scope at write time; never trust an ID from a previous fetch.
      const visible = await selectedNotifications(req);
      if (!visible.some(row => row.notification.id === id))
        return res.status(403).json({ message: "Notification is not visible in this scope" });
      if (req.params.action === "read") await storage.markNotificationRead(id, req.currentUser!.id);
      else await storage.dismissNotification(id, req.currentUser!.id);
      return res.json({ id, action: req.params.action });
    } catch (error) { return notificationError(res, next, error); }
  });
  const handler = (exportMode: boolean) => async (req: Request, res: any, next: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const input = req.query.branchIds;
      if (input !== undefined && typeof input !== "string") return res.status(400).json({ message: "branchIds must be comma-separated" });
      const requested = input === undefined || input === "all" ? "all" as const : input.split(",").map(v => v.trim());
      if (requested !== "all" && (!requested.length || requested.length > MAX_BRANCHES || requested.some(v => !v || v === "all") || new Set(requested).size !== requested.length))
        return res.status(400).json({ message: "Invalid branchIds" });
      const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return res.status(400).json({ message: "Invalid offset" });
      const projection = await projectOperationsCenter(req, requested, offset, exportMode);
      return res.json(projection);
    } catch (error: any) {
      if (error?.status === 400 || error?.status === 403) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  };
  app.get("/api/operations-center", isAuthenticated, requirePermission("operations", "view"), handler(false));
  app.get("/api/operations-center/export", isAuthenticated, requirePermission("operations", "export"), handler(true));
}