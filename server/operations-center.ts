import type { Express, Request } from "express";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import {
  branches, maintenanceTickets, centralKitchenOrders, materialTransfers, reverseMovements,
  leaveRequests, advanceRequests, qualityChecks, branchDailyClosures, cashierSalesJournals,
  branchShifts, timesheetReports, salaryClosures, salaryPayments, operationsPayrollReviews, pnlMonthlyInputs,
  attendanceRecords, maintenanceTicketEvents, branchComplaints,
} from "@shared/schema";
import { qualityPassRate, deduplicateOperationsQueue, validateOperationsBranches, availableCardMetrics, isOperationsInvestigationEvidence, operationsDecisionMetadata, operationsAdvanceDecisionMetadata, operationsAdvanceFinalAuthority, makeOperationsQueueItem as queueItem } from "@shared/operations-center";
import { buildOperationsObservations, operationsDateRange, operationsMonthPeriod, operationsPerformancePeriod, parseOperationsPerformanceDays, projectRegisteredSales, registeredSalesHref } from "@shared/operations-performance";
import { canonicalOperationsInsights, loadOperationsRegisteredSales, operationsEvidenceRevision, operationsInsightRecords } from "./operations-performance";
import { noticeInSelectedScope, publicCenterNotice } from "@shared/operations-center-notifications";
import type { OperationsCenterResponse, OperationsMetric, OperationsQueueItem, OperationsEvidenceDay, OperationsMonthSection, OperationsInsightsResponse } from "@shared/operations-center";
import { db } from "./db";
import { pool } from "./db";
import { storage } from "./storage";
import { activeDeliveryStatuses } from "@shared/delivery";
import { canAccessDeliveryWorkspace } from "@shared/delivery-workspace-access";
import { getAllowedBranchIds, isAuthenticated, requirePermission, HR_SPECIALIST_PERMISSIONS } from "./auth";
import { branchOperationsDefinitions, hasEffectiveViewPermission, loadAuthorizedBranchOperationsCard } from "./branch-operations";
import { resolveReviewerJobTitle, reviewerMatchesStep } from "./leave-helpers";
import { registerOperationsMonthWorkflow } from "./operations-month-workflow";

const MAX_BRANCHES = 30;
const SOURCE_LIMIT = 101;
const PAGE_LIMIT = 100;
const CARD_CONCURRENCY = 6;
const SOURCE_CONCURRENCY = 4;
const PERMISSION_CONCURRENCY = 6;
const INSIGHT_COOLDOWN_MS = 60_000;
const lastInsightRequest = new Map<string, number>();
let activeInsightRequests = 0;
const MAX_ACTIVE_INSIGHTS = 3;
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
export async function projectOperationsCenter(req: Request, requested: string[] | "all", offset: number, exportMode = false,
  performanceDays = parseOperationsPerformanceDays(req.query?.performanceDays)): Promise<OperationsCenterResponse> {
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
  const performancePeriod = operationsPerformancePeriod(now, parseOperationsPerformanceDays(performanceDays));
  const performanceDates = operationsDateRange(performancePeriod.from, performancePeriod.to);
  const dates = Array.from({ length: 7 }, (_, i) => dateInRiyadh(new Date(now.getTime() - (6 - i) * 86400000)));
  const permitted = async (module: string) => await hasEffectiveViewPermission(req, module)
    && (!exportMode || await hasEffectiveViewPermission(req, module, "export"));
  const grants = new Map<string, boolean>();
  const modules = [...new Set([...branchOperationsDefinitions.map(d => d.module), "branch_complaints", "sales_analytics", "quality_control", "hr_leaves", "hr_advances", "warehouse", "shifts", "cashier_journal", "delivery_tasks", "attendance"])];
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
      assignee: maintenanceTickets.assigneeUserId, due: maintenanceTickets.dueAt, priority: maintenanceTickets.priority,
      created: maintenanceTickets.createdAt, updated: maintenanceTickets.updatedAt })
      .from(maintenanceTickets).where(and(inArray(maintenanceTickets.branchId, branchIds),
        inArray(maintenanceTickets.status, ["open", "assigned", "in_progress"]))).orderBy(desc(maintenanceTickets.createdAt)).limit(SOURCE_LIMIT);
    const events = rows.length ? await db.select({ ticketId: maintenanceTicketEvents.ticketId,
      at: maintenanceTicketEvents.createdAt, type: maintenanceTicketEvents.eventType,
      actorId: maintenanceTicketEvents.actorUserId }).from(maintenanceTicketEvents)
      .where(inArray(maintenanceTicketEvents.ticketId, rows.map(row => row.id)))
      .orderBy(desc(maintenanceTicketEvents.createdAt)).limit(1000) : [];
    return rows.map(r => ({
      ...queueItem("maintenance", r.id, r.status, r.branchId, "maintenance", "بلاغ صيانة", r.status, link("/maintenance", r.branchId), r.assignee || "غير محدد", asIso(r.due), r.assignee),
      ...(r.priority === "urgent" ? { priorityReason: "urgent" as const } : {}),
      reason: r.priority === "urgent" ? "بلاغ صنّفته جهة المصدر عاجلًا؛ يحتاج تدخل الصيانة" : `بلاغ صيانة بالحالة المسجلة ${r.status}`,
      history: events.filter(event => event.ticketId === r.id).slice(0, 8)
        .map(event => ({ at: asIso(event.at)!, label: event.type, actorId: event.actorId })),
    }));
  });
  source("complaints", "branch_complaints", async () => {
    const rows = await db.select({ id: branchComplaints.id, branchId: branchComplaints.branchId,
      status: branchComplaints.status, priority: branchComplaints.priority,
      owner: branchComplaints.ownerUserId, due: branchComplaints.responseDue,
      responded: branchComplaints.firstRespondedAt,
      created: branchComplaints.createdAt, updated: branchComplaints.updatedAt }).from(branchComplaints)
      .where(and(inArray(branchComplaints.branchId, branchIds), inArray(branchComplaints.status, ["open", "in_progress", "resolved"])))
      .orderBy(desc(branchComplaints.createdAt)).limit(SOURCE_LIMIT);
    const canApprove = await hasEffectiveViewPermission(req, "branch_complaints", "approve");
    return rows.map(row => {
      const item = queueItem("branch_complaint", row.id, row.status, row.branchId, "branch_complaints",
        row.status === "resolved" ? "شكوى محلولة تنتظر مراجعة الإغلاق" : "شكوى فرع تحتاج متابعة",
        row.status, link("/branch-complaints", row.branchId), row.owner || "غير محدد",
        // responseDue is the first-response deadline, never a closure deadline.
        row.status !== "resolved" && !row.responded ? asIso(row.due) : null, row.owner);
      return {
        ...item,
        ...(row.priority === "urgent" ? { priorityReason: "urgent" as const } : {}),
        decision: operationsDecisionMetadata(item, req.currentUser!.id, canApprove, row.status === "resolved",
          { module: "branch_complaints", action: "approve" }, "مراجعة الحل وإغلاق الشكوى"),
        reason: row.status === "resolved" ? "الحل مسجل؛ الشكوى لم تُغلق بعد وتحتاج مراجعة المخول بالإغلاق"
          : row.priority === "urgent" ? "شكوى صنّفتها جهة المصدر عاجلة" : `شكوى بالحالة المسجلة ${row.status}`,
        history: [{ at: asIso(row.created)!, label: "إنشاء الشكوى" },
          ...(row.responded ? [{ at: asIso(row.responded)!, label: "بدء المعالجة مسجل؛ موعد الرد الأول ليس موعد إغلاق" }] : []),
          { at: asIso(row.updated)!, label: "آخر تحديث مسجل؛ ليس سجلًا كاملًا للتغييرات" }],
      };
    });
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
      level: leaveRequests.currentLevel, chain: leaveRequests.approvalChain }).from(leaveRequests)
      .where(and(inArray(leaveRequests.branchId, branchIds), eq(leaveRequests.status, "pending")))
      .orderBy(desc(leaveRequests.id)).limit(SOURCE_LIMIT);
    const canApprove = await hasEffectiveViewPermission(req, "hr_leaves", "approve");
    const user = req.currentUser!;
    const title = canApprove && !["admin", "super_admin"].includes(user.role) ? await resolveReviewerJobTitle(user.id) : null;
    return rows.map(r => {
      const item = queueItem("leave", r.id, `level_${r.level}`, r.branchId, "hr_leaves", "طلب إجازة", r.status, link("/hr/leaves", r.branchId));
      const chain = Array.isArray(r.chain) ? r.chain as { level: number; jobTitle?: string; stepName?: string }[] : [];
      const expected = chain.find(step => Number(step.level) === r.level);
      const matches = !expected?.jobTitle || ["admin", "super_admin"].includes(user.role)
        || chain.some(step => Number(step.level) >= r.level && !!step.jobTitle
          && reviewerMatchesStep({ reviewerJobTitle: title, reviewerRole: user.role, expectedJobTitle: step.jobTitle! }));
      return { ...item, owner: expected?.stepName || expected?.jobTitle || "مراجع الإجازات المخول",
        decision: operationsDecisionMetadata(item, user.id, canApprove, matches, { module: "hr_leaves", action: "approve" }, "مراجعة الإجازة واتخاذ القرار") };
    });
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
    const canApprove = await hasEffectiveViewPermission(req, "hr_advances", "approve");
    const canEdit = await hasEffectiveViewPermission(req, "hr_advances", "edit");
    const user = req.currentUser!;
    const finalAuthority = operationsAdvanceFinalAuthority(user.role, (HR_SPECIALIST_PERMISSIONS["hr_advances"] || []).includes("edit"));
    return rows.map(r => {
      const item = queueItem("advance", r.id, r.status, r.branchId, "hr_advances", "طلب سلفة", r.status,
        link("/hr/advances", r.branchId), r.status === "awaiting_signature" ? "الموظف" : r.status === "pending" ? "مدير التشغيل" : "شؤون الموظفين");
      return { ...item, decision: operationsAdvanceDecisionMetadata(item, user.id, finalAuthority, canApprove, canEdit) };
    });
  });
  source("quality", "quality_control", async () => {
    const rows = await db.select({ id: qualityChecks.id, branchId: qualityChecks.branchId, result: qualityChecks.result })
      .from(qualityChecks).where(and(inArray(qualityChecks.branchId, branchIds), eq(qualityChecks.checkDate, businessDate),
        inArray(qualityChecks.result, ["failed", "needs_improvement"])))
      .orderBy(desc(qualityChecks.id)).limit(SOURCE_LIMIT);
    return rows.map(r => ({
      ...queueItem("quality_check", r.id, r.result, r.branchId, "quality_control", "دليل جودة يحتاج التحقيق",
        r.result, link("/quality-control", r.branchId)),
      reason: `نتيجة فحص مسجلة ليوم ${businessDate} تحتاج التحقيق؛ المصدر لا يسجل معالجة أو إغلاقًا، وليست مهمة قابلة للإكمال`,
    }));
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
    const canApprove = await hasEffectiveViewPermission(req, "cashier_journal", "approve");
    return rows.map(r => {
      const item = queueItem("cashier_journal", r.id, r.status, r.branchId, "cashier_journal", "يومية كاشير",
        r.status, link(`/cashier-journals?status=${r.status}`, r.branchId), r.status === "submitted" ? "المراجع المخول" : r.cashier,
        null, r.status === "submitted" ? null : r.cashier);
      return { ...item, decision: operationsDecisionMetadata(item, user.id, canApprove, r.status === "submitted",
        { module: "cashier_journal", action: "approve" }, "مراجعة واعتماد اليومية") };
    });
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
  const rank = (item: OperationsQueueItem) => item.priorityReason ? 0
    : item.decision?.awaitingActor ? 1 : item.dueAt && Date.parse(item.dueAt) < now.getTime() ? 2 : 3;
  const sorted = deduplicateOperationsQueue(queue).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
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
  let sales = projectRegisteredSales(branchIds, performanceDates, [], enabled("sales_analytics") ? "unavailable" : "forbidden", []);
  if (enabled("sales_analytics")) {
    try {
      sales = await loadOperationsRegisteredSales(branchIds, performancePeriod.from, performancePeriod.to);
    } catch (error) { console.error("Operations sales trend unavailable", error); }
  }
  const analytics: NonNullable<OperationsCenterResponse["analytics"]> = {
    generatedAt, period: performancePeriod, scope: { branchIds }, evidenceRevision: "",
    sales,
    followups: { source: "لقطة حالية لسجلات التشغيل المحمّلة من المصادر المسموح بها؛ ليست اتجاه الفترة ولا إثبات اكتمال العمل المتراكم؛ لا تشمل ملاحظات الجودة",
      coverage: Object.values(coverage).includes("complete") ? "partial" : "unavailable", period: "current",
      scan: { sourceLimit: SOURCE_LIMIT - 1, truncated, unavailableSources: Object.keys(coverage).filter(name => coverage[name] === "unavailable") },
      byBranch: branchIds.map(branchId => {
        const rows = sorted.filter(row => row.branchId === branchId && !isOperationsInvestigationEvidence(row));
        return { branchId, count: rows.length, awaitingDecision: rows.filter(row => row.decision?.awaitingActor).length,
          emergency: rows.filter(row => row.priorityReason).length };
      }) },
  };
  analytics.observations = buildOperationsObservations(branchRows, sorted, sales, performancePeriod, req.currentUser!.id);
  analytics.evidenceRevision = operationsEvidenceRevision({
    scope: { branchIds, requested, limit: PAGE_LIMIT },
    coverage: { queue: coverage, truncated, nextOffset: null },
    queue: sorted,
  }, analytics);
  return {
    generatedAt, businessDate, scope: { branchIds, requested, limit: PAGE_LIMIT }, branches: branchRows,
    modules: [...grants].filter(([, value]) => value).map(([name]) => name), cards, metrics, queue: page, daily, analytics,
    weekly: [{ startDate: dates[0], endDate: businessDate, recordedClosings: daily.filter(d => d.closing === "closed").length,
      recordedJournals: enabled("cashier_journal") && daily.every(d => d.journalCount !== null)
        ? daily.reduce((sum, d) => sum + (d.journalCount || 0), 0) : null, coverage: "partial" }],
    coverage: { queue: coverage, truncated: truncated || sorted.length > offset + PAGE_LIMIT,
      nextOffset: sorted.length > offset + PAGE_LIMIT ? offset + PAGE_LIMIT : null },
  };
}

export function registerOperationsCenterRoutes(app: Express): void {
  registerOperationsMonthWorkflow(app);
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
  // Monthly evidence is deliberately not a fabricated unified financial close.
  app.get("/api/operations-center/monthly", isAuthenticated, requirePermission("operations", "view"), async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const month = req.query.month;
      const input = req.query.branchIds;
      if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
          typeof input !== "string" || !input || input === "all")
        return res.status(400).json({ message: "حدد الشهر والفروع صراحة" });
      const ids = input.split(",");
      if (ids.length > MAX_BRANCHES || ids.some(id => !id || id === "all") || new Set(ids).size !== ids.length)
        return res.status(400).json({ message: "نطاق غير صالح" });
      const allowed = getAllowedBranchIds(req);
      if (allowed !== null && ids.some(id => !allowed.includes(id)))
        return res.status(403).json({ message: "فرع خارج صلاحياتك" });
      const existing = await db.select({ id: branches.id }).from(branches).where(inArray(branches.id, ids));
      if (!validateOperationsBranches(ids, allowed, existing.map(row => row.id)))
        return res.status(403).json({ message: "فرع غير موجود أو خارج النطاق" });
      const sections: OperationsMonthSection[] = [];
      const section = async (id: OperationsMonthSection["id"], label: string, source: string, href: string | null, load: () => Promise<Omit<OperationsMonthSection, "id" | "label" | "source" | "href">>) => {
        const roles = { payroll: "شؤون الموظفين والمالية", expenses: "المالية", closing: "مسؤول إغلاق الفرع", sales: "مسؤول المبيعات" };
        const steps = { payroll: "مراجعة ملف الرواتب والصرف", expenses: "مطابقة المصروفات المسجلة", closing: "متابعة الإغلاقات غير المكتملة", sales: "مراجعة المبيعات ومصادرها" };
        try {
          const result = await load();
          sections.push({ id, label, source, href, status: result.verifiedGaps?.length ? "needs_review" : result.value === null ? "unknown" : "recorded",
            verifiedGaps: [], responsibleRole: roles[id], nextStep: { label: steps[id], href }, ...result,
            branches: result.branches?.map(branch => ({ status: branch.verifiedGaps?.length ? "needs_review" as const : branch.value === null ? "unknown" as const : "recorded" as const,
              verifiedGaps: [], responsibleRole: roles[id], nextStep: { label: steps[id], href: branch.href }, ...branch })),
          });
        }
        catch (error) {
          console.error(`Operations monthly ${id} unavailable`, error);
          sections.push({ id, label, source, href, summary: "تعذر تحميل المصدر؛ لا يعني ذلك عدم وجود سجلات", value: null, coverage: "unavailable",
            status: "unavailable", verifiedGaps: [], responsibleRole: null, nextStep: { label: "إعادة تحميل المصدر", href } });
        }
      };
      // A multi-branch selection is a report, never a mutation-capable "all" destination.
      const salaryPage = req.currentUser?.role === "operations_manager" ? "/hr-hub" : "/salary-closing";
      const monthlyLink = (path: string, branchId: string) => `${path}?${new URLSearchParams({ branchId, month })}`;
      const salaryLink = (branchId: string) => `${salaryPage}?${new URLSearchParams({
        [salaryPage === "/hr-hub" ? "branchId" : "branch"]: branchId, month,
        ...(salaryPage === "/hr-hub" ? { tab: "payroll" } : {}),
      })}`;
      if (await hasEffectiveViewPermission(req, req.currentUser?.role === "operations_manager" ? "operations_payroll" : "salary_closing")
          && await hasEffectiveViewPermission(req, req.currentUser?.role === "operations_manager" ? "operations_hr" : "employee_reports"))
        await section("payroll", "الرواتب", "لقطات الرواتب وسجلات الصرف للشهر المحدد", ids.length === 1
          ? salaryLink(ids[0]) : null, async () => {
          const rows = await db.select({ branchId: salaryClosures.branchId, status: salaryClosures.status, totalNet: salaryClosures.totalNet })
            .from(salaryClosures).where(and(inArray(salaryClosures.branchId, ids), eq(salaryClosures.month, month)));
          const closed = rows.filter(row => row.status === "closed");
          const payments = await db.select({ branchId: salaryPayments.branchId, employeeId: salaryPayments.branchEmployeeId })
            .from(salaryPayments).where(and(inArray(salaryPayments.branchId, ids), eq(salaryPayments.month, month)));
          // An unlocked month may have work-in-progress salary data; do not label it zero.
          let reviewed = 0;
          if (req.currentUser?.role === "operations_manager") {
            const reviews = await db.select({ branchId: operationsPayrollReviews.branchId }).from(operationsPayrollReviews)
              .where(and(inArray(operationsPayrollReviews.branchId, ids), eq(operationsPayrollReviews.month, month), eq(operationsPayrollReviews.reviewedBy, req.currentUser.id)));
            reviewed = new Set(reviews.map(row => row.branchId)).size;
          }
          const fmt = (n: number) => n.toLocaleString("en-US");
          const branchSummary = (id: string) => {
            const closure = rows.find(row => row.branchId === id);
            const count = new Set(payments.filter(row => row.branchId === id).map(row => row.employeeId)).size;
            return `${closure?.status === "closed" ? "لقطة مغلقة" : closure ? "لقطة أعيد فتحها" : "لم تسجل لقطة إغلاق"} · ${fmt(count)} سجلات صرف مثبتة. لا يعني غياب السجل عدم الاستحقاق.`;
          };
          return { coverage: closed.length === ids.length ? "complete" as const : "partial" as const,
            verifiedGaps: rows.filter(row => row.status !== "closed").map(row => `لقطة رواتب الفرع ${row.branchId} غير مقفلة`),
            summary: `${fmt(closed.length)} من ${fmt(ids.length)} فروع لديها لقطة رواتب مغلقة · ${fmt(payments.length)} سجل صرف مثبت للشهر${req.currentUser?.role === "operations_manager" ? ` · مراجعاتك الاستشارية: ${fmt(reviewed)}` : ""}. إجمالي اللقطات المغلقة ليس مبلغ المصروف.`,
            value: closed.length ? closed.reduce((sum, row) => sum + row.totalNet, 0) : null,
            branches: ids.map(id => ({ branchId: id, summary: branchSummary(id),
              status: rows.some(row => row.branchId === id && row.status === "closed") ? "recorded" as const : rows.some(row => row.branchId === id) ? "needs_review" as const : "unknown" as const,
              verifiedGaps: rows.some(row => row.branchId === id && row.status !== "closed") ? ["لقطة الرواتب الموجودة أعيد فتحها"] : [],
              value: rows.find(row => row.branchId === id)?.status === "closed" ? rows.find(row => row.branchId === id)!.totalNet : null,
               href: salaryLink(id) })) };
        });
      if (await hasEffectiveViewPermission(req, "pnl_dashboard") && await hasEffectiveViewPermission(req, "pnl"))
        await section("expenses", "المصروفات", "مدخلات الأرباح والخسائر والإيجار والعقود المتكررة (دون COGS)", ids.length === 1 ? monthlyLink("/pnl-dashboard", ids[0]) : null, async () => {
          const year = Number(month.slice(0, 4)), monthNumber = Number(month.slice(5, 7));
          // Match the existing expense ledger formula. Never add salary closures
          // or cost of goods here: those are independent, easily double-counted.
          const expenseRows = await mapOperationsBounded(ids, 3, async branchId => {
            const [input, rent, recurring] = await Promise.all([
              storage.getPnlMonthlyInputs(branchId, year, monthNumber),
              storage.getRentForPeriod(branchId, year, monthNumber),
              storage.getRecurringExpensesForPeriod(branchId, year, monthNumber),
            ]);
            const columns = ["electricityCost", "waterCost", "utilitiesOther", "internetCost", "governmentFees", "insuranceCost",
              "subscriptionsCost", "securityCost", "bankFees", "fuelCost", "maintenanceCost", "marketingCost", "suppliesCost", "otherCosts"] as const;
            const value = input || rent || recurring.length ? columns.reduce((sum, key) => sum + Number(input?.[key] || 0), 0)
              + Number(rent || 0) + recurring.reduce((sum, row) => sum + Number(row.monthlyAmount || 0), 0) : null;
            return { branchId, value, summary: value === null ? "لا توجد مدخلات مصروفات شهرية أو إيجار أو عقود متكررة مسجلة" :
               "مدخلات وتكاليف شهرية مسجلة؛ لا تشمل COGS ولا تعني مصروفاً مدفوعاً", href: monthlyLink("/pnl-dashboard", branchId) };
          });
          const available = expenseRows.filter(row => row.value !== null);
          return { coverage: "partial" as const, summary: `مصروفات P&L مدخلة لـ ${available.length.toLocaleString("en-US")} من ${ids.length.toLocaleString("en-US")} فروع؛ ليست تسوية نهائية أو دفتر صرف نقدي. لا تتضمن تكلفة البضاعة ولا الرواتب حتى لا تتكرر.`,
            value: available.length ? available.reduce((sum, row) => sum + (row.value ?? 0), 0) : null, branches: expenseRows };
        });
      if (await hasEffectiveViewPermission(req, "daily_closures"))
        await section("closing", "الإغلاقات التشغيلية", "سجلات إغلاق الفروع اليومية", ids.length === 1 ? monthlyLink("/branch-daily-closures", ids[0]) : null, async () => {
          const rows = await db.select({ id: branchDailyClosures.id, branchId: branchDailyClosures.branchId, status: branchDailyClosures.status }).from(branchDailyClosures)
            .where(and(inArray(branchDailyClosures.branchId, ids), gte(branchDailyClosures.closureDate, `${month}-01`), lte(branchDailyClosures.closureDate, `${month}-31`)));
          const closed = rows.filter(row => row.status === "closed").length;
          return { coverage: "partial" as const, summary: `${closed.toLocaleString("en-US")} إغلاق مسجل من ${rows.length.toLocaleString("en-US")} سجل يومي. الأيام بلا سجلات غير مصنّفة متأخرة دون موعد معتمد.`, value: rows.length ? closed : null,
             verifiedGaps: rows.filter(row => row.status !== "closed").map(row => `السجل اليومي ${row.id} غير مغلق`),
             branches: ids.map(branchId => ({ branchId, summary: `${rows.filter(row => row.branchId === branchId && row.status === "closed").length.toLocaleString("en-US")} إغلاق مؤكد من ${rows.filter(row => row.branchId === branchId).length.toLocaleString("en-US")} سجل`,
               verifiedGaps: rows.filter(row => row.branchId === branchId && row.status !== "closed").map(row => `السجل اليومي ${row.id} غير مغلق`),
               value: rows.some(row => row.branchId === branchId) ? rows.filter(row => row.branchId === branchId && row.status === "closed").length : null, href: monthlyLink("/branch-daily-closures", branchId) })) };
        });
      if (await hasEffectiveViewPermission(req, "sales_analytics"))
        await section("sales", "المبيعات المسجلة", "cashier_sales_journals.total_sales؛ اليوميات المرحلة والمعتمدة؛ نفس تحليلات المبيعات",
          ids.length === 1 ? registeredSalesHref(ids[0], operationsMonthPeriod(month).from, operationsMonthPeriod(month).to) : null, async () => {
          const period = operationsMonthPeriod(month);
          const sales = await loadOperationsRegisteredSales(ids, period.from, period.to);
          return { coverage: "partial" as const, summary: `${sales.recordedCount!.toLocaleString("en-US")} يومية مرحلة أو معتمدة في ${sales.recordedBranchDays!.toLocaleString("en-US")} يوم فرع مسجل. إجمالي مسجل، وليس صافيًا بعد المرتجعات؛ غياب السجلات ليس صفراً ولا تُضاف لقطات الإغلاق.`,
            value: sales.total,
            branches: sales.byBranch.map(branch => ({
              branchId: branch.branchId,
              summary: branch.state === "no_records" ? `لا توجد يوميات مرحلة أو معتمدة في الشهر${branch.lastRecordedDate ? `؛ آخر تاريخ مسجل: ${branch.lastRecordedDate}` : "؛ لا يوجد تاريخ مسجل سابق"}`
                : `${branch.recordedCount!.toLocaleString("en-US")} يومية مرحلة أو معتمدة · ${branch.recordedBranchDays!.toLocaleString("en-US")} يوم فرع مسجل؛ ليست مبيعات صافية مصححة بالمرتجعات`,
              value: branch.total, href: registeredSalesHref(branch.branchId, period.from, period.to),
            })) };
        });
      return res.json({ month, branchIds: ids, sections });
    } catch (error) { next(error); }
  });
  app.post("/api/operations-center/insights", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    let acquired = false;
    let providerStarted = false;
    let context: Omit<OperationsInsightsResponse, "kind" | "status" | "insights"> = {
      generatedAt: new Date().toISOString(), evidenceRevision: null,
      period: operationsPerformancePeriod(new Date(), 7), scope: { branchIds: [] },
    };
    const reply = (code: number, status: OperationsInsightsResponse["status"], message?: string, retryAfterSeconds?: number) =>
      res.status(code).json({ kind: "ai", status, ...context, insights: [], ...(message ? { message } : {}),
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } satisfies OperationsInsightsResponse);
    try {
      res.set("Cache-Control", "no-store");
      const input = req.body?.branchIds;
      if (!Array.isArray(input) || !input.length || input.length > MAX_BRANCHES || input.some(id => typeof id !== "string" || !id || id === "all") || new Set(input).size !== input.length)
        return reply(400, "error", "حدد فروعاً صريحة للتحليل");
      const performanceDays = parseOperationsPerformanceDays(req.body?.performanceDays);
      context.period = operationsPerformancePeriod(new Date(), performanceDays);
      context.scope = { branchIds: input };
      const requestedMonth = req.body?.month;
      if (requestedMonth !== undefined && (typeof requestedMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)))
        return reply(400, "error", "حدد شهراً صحيحاً للتحليل");
      const allowed = getAllowedBranchIds(req);
      if (allowed !== null && input.some(id => !allowed.includes(id))) return reply(403, "forbidden", "فرع خارج صلاحياتك");
      const userId = req.currentUser!.id;
      const now = Date.now();
      if (now - (lastInsightRequest.get(userId) ?? 0) < INSIGHT_COOLDOWN_MS) {
        const retryAfter = Math.ceil((INSIGHT_COOLDOWN_MS - (now - lastInsightRequest.get(userId)!)) / 1000);
        res.set("Retry-After", String(retryAfter));
        return reply(429, "cooldown", "انتظر قبل إعادة طلب التحليل الذكي.", retryAfter);
      }
      if (activeInsightRequests >= MAX_ACTIVE_INSIGHTS)
        return reply(503, "unavailable", "التحليل الذكي مشغول الآن؛ أعد المحاولة لاحقاً.");
      // Reserve synchronously before the first await, including the database
      // projection: concurrent clicks cannot generate parallel paid calls.
      activeInsightRequests++;
      acquired = true;
      lastInsightRequest.set(userId, now);
      if (lastInsightRequest.size > 1024) {
        for (const [id, stamp] of lastInsightRequest)
          if (now - stamp > INSIGHT_COOLDOWN_MS) lastInsightRequest.delete(id);
      }
      const data = await projectOperationsCenter(req, input, 0, false, performanceDays);
      context = { generatedAt: data.generatedAt, evidenceRevision: data.analytics!.evidenceRevision,
        period: data.analytics!.period, scope: { branchIds: data.scope.branchIds }, coverage: data.coverage };
      const records = operationsInsightRecords(data);
      // No employee names, IDs, URLs, or raw record text leave this server.
      // The model returns only an index; all provenance is reattached below.
      const rows = records.map(item => ({ sourceType: item.sourceType,
        status: /^[\p{L}\s_-]{1,60}$/u.test(item.status) ? item.status : "غير محدد",
        dueAt: item.dueAt, branchBucket: data.scope.branchIds.indexOf(item.branchId),
        awaitingDecision: item.awaitingDecision, sourceUrgency: item.sourceUrgency,
        evidence: item.evidence,
        salesTrend: item.sourceType === "sales_trend" ? data.analytics?.sales.byBranch?.find(branch => branch.branchId === item.branchId)?.daily : undefined }));
      if (!rows.length) {
        if (data.analytics!.sales.state === "unavailable" || Object.values(data.coverage.queue).includes("unavailable"))
          return reply(503, "unavailable", "تعذر تحميل الأدلة المسموح بها؛ لا يعني ذلك عدم وجود سجلات.");
        if (data.analytics!.sales.state === "forbidden" && !Object.keys(data.coverage.queue).length)
          return reply(403, "forbidden", "لا تملك صلاحية عرض مصادر الأدلة لهذا التحليل؛ لا يعني ذلك عدم وجود سجلات.");
        return reply(200, "no_evidence", "لا توجد أدلة مسجلة ضمن النطاق المسموح والفترة المختارة؛ غياب الدليل ليس صفراً.");
      }
      const key = process.env.OPENAI_API_KEY;
      if (!key) return reply(503, "unavailable", "التحليل الذكي غير متاح الآن؛ الملاحظات المسجلة ليست تحليلاً ذكياً.");
      providerStarted = true;
      const OpenAI = (await import("openai")).default;
      const completion = await new OpenAI({ apiKey: key, timeout: 15_000, maxRetries: 0 }).chat.completions.create({
        model: "gpt-5", max_completion_tokens: 1000, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "حلل أدلة تشغيل حقيقية مجهولة الهوية. مبيعات الفترة هي إجمالي total_sales في اليوميات المرحلة والمعتمدة فقط، نفس تحليلات المبيعات؛ ليست صافيًا مصححًا بالمرتجعات ولا تجمع لقطات الإغلاق. المتابعات لقطة حالية محدودة وليست اتجاه الفترة. أعد JSON فقط: {\"insights\":[{\"index\":0,\"title\":\"نص عربي قصير\",\"explanation\":\"ما الذي يحتاج انتباها ولماذا وما الخطوة المقترحة\"}]}. index فهرس دليل. اختر حتى 3 أدلة مختلفة. null ليس صفراً. لا تستنتج اتجاهًا من أيام مفقودة. لا تختلق أهدافًا أو مسؤولين أو مواعيد أو طوارئ أو اكتمالًا. اقترح متابعة بدليل واضح ولا تنفذ إجراءً." },
          { role: "user", content: JSON.stringify({ generatedAt: data.generatedAt, evidenceRevision: data.analytics!.evidenceRevision,
            period: data.analytics!.period, scope: { branchBuckets: data.scope.branchIds.map((_, index) => index) },
            businessDate: data.businessDate, rows, coverage: data.coverage,
            followups: { period: "current", coverage: data.analytics!.followups.coverage, scan: data.analytics!.followups.scan,
              byBranch: data.analytics!.followups.byBranch.map(({ branchId, ...counts }) => ({
                branchBucket: data.scope.branchIds.indexOf(branchId), ...counts,
              })) },
            sales: { definition: data.analytics!.sales.definition, state: data.analytics!.sales.state,
              recordedCount: data.analytics!.sales.recordedCount, recordedBranchDays: data.analytics!.sales.recordedBranchDays,
              lastRecordedDate: data.analytics!.sales.lastRecordedDate } }) },
        ],
      });
      const insights = canonicalOperationsInsights(JSON.parse(completion.choices[0]?.message?.content || "{}"), records);
      if (!insights.length) return reply(503, "error", "لم يُرجع التحليل اقتراحات صالحة مدعومة بالأدلة؛ أعد المحاولة لاحقاً.");
      return res.json({ kind: "ai", status: "ready", ...context, insights } satisfies OperationsInsightsResponse);
    } catch (error: any) {
      if (!providerStarted && error?.status === 400) return reply(400, "error", "حدد فترة صحيحة ونطاق فروع صريحًا للتحليل.");
      if (!providerStarted && error?.status === 403) return reply(403, "forbidden", "نطاق الفرع غير مسموح أو غير موجود");
      return reply(503, "error", "تعذر إنشاء التحليل الذكي الآن؛ لم يُنفذ أي إجراء. يمكنك استخدام الملاحظات المسجلة أو إعادة المحاولة.");
    }
    finally { if (acquired) activeInsightRequests--; }
  });
}