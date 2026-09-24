import type { Express, Request } from "express";
import { and, count, desc, eq, inArray, lt, ne, or, sql } from "drizzle-orm";
import {
  advanceRequests,
  branchDailyClosures,
  branchComplaints,
  branchEmployees,
  branches,
  branchShifts,
  centralKitchenOrders,
  dailyWasteLog,
  cashierSalesJournals,
  materialTransfers,
  branchMonthlyTargets,
  targetDailyAllocations,
  purchasingRequests,
} from "@shared/schema";
import type {
  BranchOperationsCard,
  BranchOperationsSummaryResponse,
} from "@shared/branch-operations";
import { db } from "./db";
import { storage } from "./storage";
import { readEmployeeDocumentMetadata } from "./employee-documents-read";
import { kitchenActionAllowed } from "./central-kitchen-routing";
import {
  BRANCH_MANAGER_INTRINSIC_PERMISSIONS,
  FINANCIAL_MANAGER_PERMISSIONS,
  HR_MANAGER_MODULES,
  HR_SPECIALIST_PERMISSIONS,
  OPERATIONS_MANAGER_PERMISSIONS,
  PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS,
  canAccessBranch,
  isAuthenticated,
} from "./auth";

type CardId = BranchOperationsCard["id"];

interface CardDefinition {
  id: CardId;
  title: string;
  group: BranchOperationsCard["group"];
  module: string;
  href: string;
  load: (branchId: string, businessDate: string, req: Request) => Promise<Pick<BranchOperationsCard, "metrics" | "alerts" | "actions" | "description" | "statusLabel">>;
}

const branchHref = (path: string, branchId: string) =>
  `${path}${path.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`;

const definitions: CardDefinition[] = [
  { id: "maintenance", title: "الصيانة", group: "operations", module: "maintenance", href: "/maintenance",
    load: async () => ({ metrics: [], alerts: [], statusLabel: "سجل الصيانة", description: "عرض سجل الصيانة الحالي؛ لا يتوفر مصدر بلاغات بمسؤول وموعد إغلاق." }) },
  {
    id: "complaints", title: "شكاوى الفروع", group: "operations", module: "branch_complaints", href: "/branch-complaints",
    load: async (branchId) => {
      const now = new Date();
      const [[open], [resolved], [overdue]] = await Promise.all([
        db.select({ value: count() }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId),
          inArray(branchComplaints.status, ["open", "in_progress"]),
        )),
        db.select({ value: count() }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId), eq(branchComplaints.status, "resolved"),
        )),
        db.select({ value: count(), oldestDue: sql<string | Date | null>`min(${branchComplaints.responseDue})` }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId),
          ne(branchComplaints.status, "closed"),
          lt(branchComplaints.responseDue, now),
          sql`${branchComplaints.firstRespondedAt} is null`,
        )),
      ]);
      const openCount = Number(open.value);
      const overdueCount = Number(overdue.value);
      const href = branchHref("/branch-complaints", branchId);
      return {
        metrics: [{ label: "مفتوحة وقيد المعالجة", value: openCount }, { label: "محلولة بانتظار الإغلاق", value: Number(resolved.value) }, { label: "تجاوزت موعد الرد الأول", value: overdueCount }],
        alerts: overdueCount ? [{ label: "شكاوى متأخرة بلا رد أول (أقدم موعد)", count: overdueCount, href, priority: "high",
          dueAt: overdue.oldestDue ? new Date(overdue.oldestDue).toISOString() : undefined,
          actionLabel: "عرض المتابعة", description: "الموعد المعروض هو أقدم موعد رد أول متجاوز بين هذه الشكاوى؛ رابط متابعة وليس إجراء تعديل." }] : [],
      };
    },
  },
  {
    id: "waste", title: "الهدر", group: "operations", module: "waste_tracking", href: "/display-bar-waste",
    load: async (branchId, businessDate) => {
      const [row] = await db.select({ value: count() }).from(dailyWasteLog)
        .innerJoin(branchShifts, eq(dailyWasteLog.shiftId, branchShifts.id))
        .where(and(eq(branchShifts.branchId, branchId), eq(branchShifts.shiftDate, businessDate)));
      const value = Number(row?.value || 0);
      return {
        metrics: [{ label: "سجلات هدر اليوم", value }],
        alerts: [],
        description: "معلومة عن الهدر المسجل اليوم، وليست مهاماً معلقة.",
      };
    },
  },
  {
    id: "purchasing", title: "المشتريات", group: "operations", module: "warehouse", href: "/purchasing-requests",
    load: async (branchId) => {
      const rows = await db.select({ status: purchasingRequests.status, value: count() }).from(purchasingRequests)
        .where(and(eq(purchasingRequests.branchId, branchId), inArray(purchasingRequests.status, ["pending", "approved", "ordered"])))
        .groupBy(purchasingRequests.status);
      const counts = new Map(rows.map(row => [row.status, Number(row.value)]));
      return {
        metrics: [
          { label: "بانتظار الإدارة", value: counts.get("pending") || 0 },
          { label: "معتمدة بانتظار الطلب", value: counts.get("approved") || 0 },
          { label: "مطلوبة من المورد", value: counts.get("ordered") || 0 },
        ],
        alerts: [],
        description: "متابعة معلوماتية؛ المعالجة لدى المشتريات أو الإدارة وليست إجراء اعتماد على مستخدم الفرع.",
      };
    },
  },
  {
    id: "kitchen", title: "طلبات المطبخ", group: "operations", module: "central_kitchen_orders", href: "/central-kitchen-orders",
    load: async (branchId, _businessDate, req) => {
      const rows = await db.select({ status: centralKitchenOrders.status, value: count() })
        .from(centralKitchenOrders)
        .where(and(
          eq(centralKitchenOrders.requestBranchId, branchId),
          inArray(centralKitchenOrders.status, ["requested", "approved", "prepared", "dispatched"]),
        ))
        .groupBy(centralKitchenOrders.status);
      const counts = new Map(rows.map((row) => [row.status, Number(row.value)]));
      const incoming = counts.get("dispatched") || 0;
      const canReceive = incoming > 0 && await hasEffectiveViewPermission(req, "central_kitchen_orders", "edit")
        && await kitchenActionAllowed(db, req.currentUser!.id, { requestBranchId: branchId }, "receive");
      const href = branchHref("/central-kitchen-orders", branchId);
      return {
        metrics: ["requested", "approved", "prepared", "dispatched"].map((status, index) => ({
          label: ["مطلوبة", "معتمدة", "مجهزة", "مرسلة للفرع"][index], value: counts.get(status) || 0,
        })),
        alerts: canReceive ? [{ label: "طلبات يمكنك استلامها", count: incoming, href, priority: "normal", actionLabel: "تأكيد الاستلام" }] : [],
        description: "مراحل طلبات الفرع؛ يظهر إجراء الاستلام للمستلم المخول فقط.",
      };
    },
  },
  {
    id: "closing", title: "الإغلاق اليومي", group: "operations", module: "daily_closures", href: "/branch-daily-closing",
    load: async (branchId, businessDate) => {
      const [closure] = await db.select({ status: branchDailyClosures.status }).from(branchDailyClosures)
        .where(and(eq(branchDailyClosures.branchId, branchId), eq(branchDailyClosures.closureDate, businessDate)))
        .orderBy(desc(branchDailyClosures.id))
        .limit(1);
      const [previous] = await db.select({ value: count(), oldestDate: sql<string | null>`min(${branchDailyClosures.closureDate})` }).from(branchDailyClosures).where(and(
        eq(branchDailyClosures.branchId, branchId), lt(branchDailyClosures.closureDate, businessDate), ne(branchDailyClosures.status, "closed"),
      ));
      const overdue = Number(previous.value);
      const href = branchHref("/branch-daily-closing", branchId);
      return {
        statusLabel: !closure ? "لم يبدأ إغلاق اليوم" : closure.status === "closed" ? "إغلاق اليوم مكتمل" : "إغلاق اليوم قيد الإكمال",
        metrics: [{ label: "إغلاقات سابقة غير مكتملة", value: overdue }],
        // closureDate is a business date, not a configured due instant. Do not turn
        // midnight into a fabricated dueAt/cutoff; expose the oldest date as context.
        alerts: overdue ? [{ label: "إغلاقات سابقة غير مكتملة", count: overdue, href, priority: "high", actionLabel: "عرض المتابعة",
          description: previous.oldestDate ? `أقدم سجل غير مكتمل: ${previous.oldestDate}؛ تاريخ السجل وليس موعد إغلاق محدداً.` : "متابعة سجلات سابقة؛ لا يوجد موعد إغلاق محدد." }] : [],
        description: "عدم وجود سجل اليوم ليس تأخراً؛ لا يوجد موعد إغلاق ثابت معتمد.",
      };
    },
  },
  { id: "targets", title: "الأهداف", group: "sales", module: "targets", href: "/targets-dashboard",
    load: async (branchId, businessDate) => {
      const [allocation] = await db.select({ value: targetDailyAllocations.dailyTarget }).from(targetDailyAllocations)
        .innerJoin(branchMonthlyTargets, eq(targetDailyAllocations.monthlyTargetId, branchMonthlyTargets.id))
        .where(and(eq(branchMonthlyTargets.branchId, branchId), eq(branchMonthlyTargets.yearMonth, businessDate.slice(0, 7)),
          eq(targetDailyAllocations.targetDate, businessDate), inArray(branchMonthlyTargets.status, ["active", "locked"])))
        .orderBy(desc(branchMonthlyTargets.id), desc(targetDailyAllocations.id)).limit(1);
      return { metrics: allocation ? [{ label: "هدف اليوم المعتمد", value: Number(allocation.value), unit: "ر.س" }] : [],
        alerts: [], statusLabel: allocation ? "توزيع يومي معتمد" : "لا يوجد هدف يومي معتمد",
        description: "من التوزيع اليومي الفعلي فقط؛ لا يتم تقسيم الهدف الشهري تلقائياً." };
    } },
  { id: "sales", title: "المبيعات", group: "sales", module: "sales_analytics", href: "/sales-analytics",
    load: async (branchId, businessDate) => {
      // Same ledger and inclusion rule as storage.getTargetsVsActuals.
      // Do not call it here: it also reads targets without a targets grant and prorates missing allocations.
      const [row] = await db.select({ records: count(), value: sql<number>`coalesce(sum(${cashierSalesJournals.totalSales}::double precision), 0)` })
        .from(cashierSalesJournals).where(and(eq(cashierSalesJournals.branchId, branchId),
          eq(cashierSalesJournals.journalDate, businessDate), inArray(cashierSalesJournals.status, ["posted", "approved"])));
      return { metrics: Number(row.records) ? [{ label: "مبيعات اليوميات المعتمدة والمرحلة", value: Number(row.value), unit: "ر.س" }] : [],
        alerts: [], statusLabel: Number(row.records) ? "حسب اليوميات المعتمدة" : "لا توجد يوميات معتمدة اليوم",
        description: "نفس مصدر تحليلات المبيعات، وليس إجمالي مبيعات نقاط البيع المباشر." };
    } },
  { id: "cashier", title: "يوميات الكاشير", group: "sales", module: "cashier_journal", href: "/cashier-journals",
    load: async (branchId, businessDate) => {
      const rows = await db.select({ status: cashierSalesJournals.status, value: count() }).from(cashierSalesJournals)
        .where(and(eq(cashierSalesJournals.branchId, branchId), eq(cashierSalesJournals.journalDate, businessDate)))
        .groupBy(cashierSalesJournals.status);
      const labels: Record<string, string> = { draft: "مسودة", submitted: "بانتظار الاعتماد", approved: "معتمدة", posted: "مرحلة", rejected: "مرفوضة" };
      return { metrics: rows.map(row => ({ label: labels[row.status] || row.status, value: Number(row.value) })),
        alerts: [], statusLabel: rows.length ? "يوميات اليوم" : "لا توجد يوميات اليوم" };
    } },
  { id: "warehouse", title: "تحويلات المستودع", group: "operations", module: "warehouse", href: "/transfer-requests",
    load: async (branchId, _businessDate, req) => {
      const rows = await db.select({ source: materialTransfers.sourceBranchId, destination: materialTransfers.destinationBranchId,
        status: materialTransfers.status, value: count() }).from(materialTransfers)
        .where(and(or(eq(materialTransfers.sourceBranchId, branchId), eq(materialTransfers.destinationBranchId, branchId)),
          inArray(materialTransfers.status, ["pending", "approved", "in_transit"])))
        .groupBy(materialTransfers.sourceBranchId, materialTransfers.destinationBranchId, materialTransfers.status);
      const incoming = rows.filter(r => r.destination === branchId && r.status === "in_transit").reduce((sum, r) => sum + Number(r.value), 0);
      const outgoing = rows.filter(r => r.source === branchId).reduce((sum, r) => sum + Number(r.value), 0);
      const canReceive = incoming > 0 && await hasEffectiveViewPermission(req, "warehouse", "edit");
      return { metrics: [{ label: "واردة بانتظار الاستلام", value: incoming }, { label: "تحويلات صادرة مفتوحة", value: outgoing }],
        alerts: canReceive ? [{ label: "تحويلات يمكنك استلامها", count: incoming, href: branchHref("/transfer-requests", branchId),
          priority: "normal", actionLabel: "تأكيد الاستلام" }] : [],
        description: "سجل تحويلات المواد مستقل عن طلبات المطبخ؛ الاستلام للفرع الوجهة فقط." };
    } },
  { id: "attendance", title: "الحضور والورديات", group: "people", module: "attendance", href: "/employee-attendance-report",
    load: async () => ({ metrics: [], alerts: [], statusLabel: "عرض تقرير الحضور",
      description: "راجع التقرير للتحقق من هوية الموظف وسجلات الحضور؛ عدد الموظفين النشطين ليس تغطية وردية." }) },
  {
    id: "employees", title: "الموظفون", group: "people", module: "branch_employees", href: "/branch-employees",
    load: async (branchId) => {
      const [row] = await db.select({ value: count() }).from(branchEmployees)
        .where(and(eq(branchEmployees.branchId, branchId), eq(branchEmployees.status, "active")));
      return { metrics: [{ label: "موظفون نشطون", value: Number(row?.value || 0) }], alerts: [] };
    },
  },
  {
    id: "documents", title: "وثائق الموظفين", group: "people", module: "hr_documents", href: "/hr/employee-documents",
    load: async (branchId, businessDate) => {
      const result = await readEmployeeDocumentMetadata({
        branchIds: [branchId], activeOnly: true, includeArchived: false,
        today: businessDate, pageSize: 1,
      });
      const expiredCount = result.stats.expired;
      const soonCount = result.stats.expiringSoon;
      const hrefFor = (status: string) =>
        branchHref(`/hr/employee-documents?status=${status}&activeOnly=true`, branchId);
      return {
        metrics: [{ label: "منتهية", value: expiredCount }, { label: "تنتهي خلال 30 يوماً", value: soonCount }],
        alerts: [
          ...(expiredCount ? [{ label: "وثائق منتهية", count: expiredCount, href: hrefFor("expired"), priority: "high" as const,
            actionLabel: "عرض المتابعة", description: "عرض الوثائق المنتهية؛ تعديلها يتطلب صلاحية مستقلة." }] : []),
          ...(soonCount ? [{ label: "وثائق قاربت على الانتهاء", count: soonCount, href: hrefFor("expiring_soon"), priority: "low" as const,
            actionLabel: "عرض المتابعة", description: "تنبيه مبكر للوثائق التي تنتهي خلال 30 يوماً، وليس إجراءً متأخراً." }] : []),
        ],
      };
    },
  },
  {
    id: "advances", title: "السلف", group: "people", module: "hr_advances", href: "/hr/advances",
    load: async (branchId) => {
      const rows = await db.select({ status: advanceRequests.status, value: count() }).from(advanceRequests)
        .where(and(
          eq(advanceRequests.branchId, branchId),
          inArray(advanceRequests.status, ["pending", "pre_approved", "awaiting_signature", "signed"]),
        )).groupBy(advanceRequests.status);
      const labels: Record<string, string> = { pending: "بانتظار المراجعة", pre_approved: "موافقة أولية", awaiting_signature: "بانتظار توقيع الموظف", signed: "موقعة بانتظار الاعتماد" };
      return {
        metrics: rows.map(row => ({ label: labels[row.status], value: Number(row.value) })),
        alerts: [],
        description: "متابعة المراحل فقط؛ التوقيع للموظف والاعتماد للمخول، ولا تشمل السلف المعتمدة.",
      };
    },
  },
];

async function hasEffectiveViewPermission(req: Request, module: string, action = "view"): Promise<boolean> {
  const user = req.currentUser;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "attendance_clerk") return false;
  if (user.role === "viewer" && action !== "view") return false;
  if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)) return true;
  if (user.role === "hr_specialist" && HR_SPECIALIST_PERMISSIONS[module]?.includes(action)) return true;
  if (user.role === "production_development_manager" && PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module]?.includes(action)) return true;
  if (user.role === "financial_manager") {
    const actions = FINANCIAL_MANAGER_PERMISSIONS[module]
      || (module === "pnl" ? FINANCIAL_MANAGER_PERMISSIONS.pnl_dashboard : undefined)
      || (module === "pnl_dashboard" ? FINANCIAL_MANAGER_PERMISSIONS.pnl : undefined);
    if (actions?.includes(action)) return true;
  }
  if (user.role === "operations_manager") {
    const alias = module === "waste_tracking" ? "waste" : module === "waste" ? "waste_tracking" : module;
    if ((OPERATIONS_MANAGER_PERMISSIONS[module] || OPERATIONS_MANAGER_PERMISSIONS[alias])?.includes(action)) return true;
  }
  if (user.role === "branch_manager" && BRANCH_MANAGER_INTRINSIC_PERMISSIONS[module]?.includes(action)) return true;
  return storage.hasPermission(user.id, module, action);
}

export function registerBranchOperationsRoute(app: Express): void {
  app.get("/api/branch-operations/summary", isAuthenticated, async (req, res, next) => {
    try {
    res.set("Cache-Control", "no-store");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
    if (!branchId || branchId.toLowerCase() === "all") {
      return res.status(400).json({ message: "branchId مطلوب ويجب أن يحدد فرعاً واحداً" });
    }

    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1);
    if (!branch || !(await canAccessBranch(req, branchId))) {
      return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
    }

    // Authorization is completed before any metric query. Permission lookup
    // failures therefore fail closed and cannot accidentally expose a card.
    const allowed = await Promise.all(definitions.map((definition) =>
      hasEffectiveViewPermission(req, definition.module)));
    const visible = definitions.filter((_, index) => allowed[index]);
    if (!visible.length) return res.status(403).json({ message: "لا توجد وحدات مسموحة" });

    const generatedAt = new Date();
    const businessDate = generatedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
    const results = await Promise.allSettled(visible.map((definition) =>
      definition.load(branchId, businessDate, req)));
    const cards = visible.map((definition, index): BranchOperationsCard => {
      const result = results[index];
      const href = branchHref(definition.href, branchId);
      if (result.status === "rejected") {
        console.error(`Branch operations card failed: ${definition.id}`, result.reason);
        return { id: definition.id, title: definition.title, group: definition.group, href, state: "error", metrics: [], alerts: [] };
      }
      return { id: definition.id, title: definition.title, group: definition.group, href, state: "ready", ...result.value };
    });
    const response: BranchOperationsSummaryResponse = {
      branchId,
      generatedAt: generatedAt.toISOString(),
      businessDate,
      cards,
    };
    return res.json(response);
    } catch (error) {
      next(error);
    }
  });
}