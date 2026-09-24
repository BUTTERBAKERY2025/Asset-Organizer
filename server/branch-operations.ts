import type { Express, Request } from "express";
import { and, count, desc, eq, inArray, lt, lte, gte, ne, or, sql } from "drizzle-orm";
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
  employeeSchedules,
  attendanceRecords,
  leaveRequests,
} from "@shared/schema";
import type {
  BranchOperationsCard,
  BranchOperationsSummaryResponse,
} from "@shared/branch-operations";
import { db } from "./db";
import { storage } from "./storage";
import { readEmployeeDocumentMetadata } from "./employee-documents-read";
import { kitchenActionAllowed } from "./central-kitchen-routing";
import { summarizeBranchAttendance } from "./branch-attendance-summary";
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
  load: (branchId: string, businessDate: string, req: Request) => Promise<Pick<BranchOperationsCard, "metrics" | "alerts" | "actions" | "quickActions" | "description" | "statusLabel">>;
}

const branchHref = (path: string, branchId: string) =>
  `${path}${path.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`;

const definitions: CardDefinition[] = [
  { id: "maintenance", title: "الصيانة", group: "operations", module: "maintenance", href: "/maintenance",
    load: async () => ({ metrics: [], alerts: [], statusLabel: "سجل الصيانة", description: "عرض سجل الصيانة الحالي؛ لا يتوفر مصدر بلاغات بمسؤول وموعد إغلاق." }) },
  {
    id: "complaints", title: "شكاوى الفروع", group: "operations", module: "branch_complaints", href: "/branch-complaints",
    load: async (branchId, _businessDate, req) => {
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
          inArray(branchComplaints.status, ["open", "in_progress"]),
          lt(branchComplaints.responseDue, now),
          sql`${branchComplaints.firstRespondedAt} is null`,
        )),
      ]);
      const openCount = Number(open.value);
      const overdueCount = Number(overdue.value);
      const href = branchHref("/branch-complaints?overdue=true", branchId);
      return {
        metrics: [{ label: "مفتوحة وقيد المعالجة", value: openCount }, { label: "محلولة بانتظار الإغلاق", value: Number(resolved.value) }, { label: "تجاوزت موعد الرد الأول", value: overdueCount }],
        alerts: [...(overdueCount ? [{ label: "شكاوى متأخرة بلا رد أول (أقدم موعد)", count: overdueCount, href, priority: "high" as const,
          dueAt: overdue.oldestDue ? new Date(overdue.oldestDue).toISOString() : undefined,
          actionLabel: "عرض المتابعة", description: "الموعد المعروض هو أقدم موعد رد أول متجاوز بين هذه الشكاوى؛ رابط متابعة وليس إجراء تعديل." }] : []),
          ...(openCount > overdueCount ? [{
            label: "شكاوى غير محلولة للمتابعة", count: openCount - overdueCount,
            href: branchHref("/branch-complaints?unresolved=true&overdue=false", branchId), priority: "normal" as const,
            actionLabel: "عرض المتابعة",
            description: "مفتوحة وقيد المعالجة باستثناء المتأخرة بلا رد أول أعلاه؛ رابط متابعة وليس صلاحية تعديل.",
          }] : [])],
        quickActions: await hasEffectiveViewPermission(req, "branch_complaints", "create")
          ? [{ label: "بلاغ جديد", href: branchHref("/branch-complaints?intent=create&from=branch-operations", branchId), kind: "create" as const }]
          : [],
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
      const rows = await db.select({ status: centralKitchenOrders.status, value: count(),
        oldestNeededDate: sql<string | null>`min(${centralKitchenOrders.neededDate})`,
        oldestDue: sql<string | Date | null>`min(case
          when ${centralKitchenOrders.neededDate} is not null
            and ${centralKitchenOrders.neededTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          then (${centralKitchenOrders.neededDate}::text || ' ' || ${centralKitchenOrders.neededTime})::timestamp at time zone 'Asia/Riyadh'
          end)` })
        .from(centralKitchenOrders)
        .where(and(
          eq(centralKitchenOrders.requestBranchId, branchId),
          inArray(centralKitchenOrders.status, ["requested", "approved", "prepared", "dispatched"]),
        ))
        .groupBy(centralKitchenOrders.status);
      const counts = new Map(rows.map((row) => [row.status, Number(row.value)]));
      const incoming = counts.get("dispatched") || 0;
      const dispatched = rows.find(row => row.status === "dispatched");
      const canReceive = incoming > 0 && await hasEffectiveViewPermission(req, "central_kitchen_orders", "edit")
        && await kitchenActionAllowed(db, req.currentUser!.id, { requestBranchId: branchId }, "receive");
      // Destination reads status as a stage, but stage is the canonical list filter.
      const href = branchHref("/central-kitchen-orders?stage=dispatched", branchId);
      return {
        metrics: ["requested", "approved", "prepared", "dispatched"].map((status, index) => ({
          label: ["مطلوبة", "معتمدة", "مجهزة", "مرسلة للفرع"][index], value: counts.get(status) || 0,
        })),
        alerts: [...(incoming ? [{ label: canReceive ? "طلبات يمكنك استلامها" : "طلبات مرسلة بانتظار مستلم مخول", count: incoming, href, priority: "normal" as const, actionLabel: canReceive ? "تأكيد الاستلام" : "عرض المتابعة",
          dueAt: dispatched?.oldestDue ? new Date(dispatched.oldestDue).toISOString() : undefined,
          description: dispatched?.oldestDue
            ? `أقدم وقت احتياج محدد: ${new Date(dispatched.oldestDue).toLocaleString("ar-SA-u-ca-gregory", { timeZone: "Asia/Riyadh" })}؛ ليس موعد وصول مؤكداً.`
            : dispatched?.oldestNeededDate
              ? `أقدم تاريخ احتياج: ${dispatched.oldestNeededDate}؛ لا يوجد وقت احتياج صالح لهذه الطلبات.`
              : "لم يحدد وقت احتياج؛ تحقق من وصول الشحنة قبل تأكيد الاستلام بواسطة المستلم المخول." }] : []),
          ...["requested", "approved", "prepared"].flatMap((status, index) => {
            const value = counts.get(status) || 0;
            return value ? [{ label: ["طلبات بانتظار اعتماد المطبخ", "طلبات بانتظار تجهيز المطبخ", "طلبات مجهزة بانتظار إرسال المطبخ"][index],
              count: value, href: branchHref(`/central-kitchen-orders?stage=${status}`, branchId),
              priority: "low" as const, actionLabel: "عرض المتابعة",
              description: "المتابعة لدى المطبخ المورد؛ ليست طلبات جاهزة لتأكيد استلام الفرع." }] : [];
          })],
        description: "مراحل طلبات الفرع؛ يظهر إجراء الاستلام للمستلم المخول فقط.",
        quickActions: [
          ...(await hasEffectiveViewPermission(req, "central_kitchen_orders", "create")
            ? [{ label: "طلب جديد", href: branchHref("/central-kitchen-orders?intent=create&from=branch-operations", branchId), kind: "create" as const }] : []),
          ...(canReceive ? [{ label: "استلام طلبات المطبخ", href: branchHref("/central-kitchen-orders?stage=dispatched", branchId), kind: "receive" as const }] : []),
        ],
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
      const href = branchHref(`/branch-daily-closing${previous.oldestDate ? `?date=${encodeURIComponent(previous.oldestDate)}` : ""}`, branchId);
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
    load: async (branchId, businessDate, req) => {
      // Match cashier route actor scope, not generic role/intrinsic approve grants.
      const user = req.currentUser!;
      const allCashiers = ["admin", "manager"].includes(user.role)
        || await storage.hasPermission(user.id, "cashier_performance", "approve")
        || await storage.hasPermission(user.id, "cashier_journal", "approve");
      const canEdit = await hasEffectiveViewPermission(req, "cashier_journal", "edit");
      // Seeing all cashiers (e.g. manager/performance approver) is not journal approval authority.
      const canApprove = await hasEffectiveViewPermission(req, "cashier_journal", "approve");
      const actor = allCashiers ? undefined : eq(cashierSalesJournals.cashierId, user.id);
      const rows = await db.select({ status: cashierSalesJournals.status, value: count() }).from(cashierSalesJournals)
        .where(and(eq(cashierSalesJournals.branchId, branchId), eq(cashierSalesJournals.journalDate, businessDate), actor))
        .groupBy(cashierSalesJournals.status);
      const pending = await db.select({ status: cashierSalesJournals.status, value: count(),
        oldestDate: sql<string>`min(${cashierSalesJournals.journalDate})` }).from(cashierSalesJournals)
        .where(and(eq(cashierSalesJournals.branchId, branchId), lte(cashierSalesJournals.journalDate, businessDate),
          inArray(cashierSalesJournals.status, ["draft", "rejected", "submitted"]), actor))
        .groupBy(cashierSalesJournals.status);
      const labels: Record<string, string> = { draft: "مسودة", submitted: "بانتظار الاعتماد", approved: "معتمدة", posted: "مرحلة", rejected: "مرفوضة" };
      return { metrics: rows.map(row => ({ label: labels[row.status] || row.status, value: Number(row.value) })),
        alerts: pending.filter(row => Number(row.value) > 0).map(row => ({
          label: row.status === "submitted" ? "يوميات مقدمة بانتظار المراجعة" : row.status === "draft" ? "مسودات تحتاج المراجعة والإكمال" : "يوميات مرفوضة تحتاج متابعة",
          count: Number(row.value), priority: "normal" as const,
          href: branchHref(`/cashier-journals?status=${row.status}&startDate=${row.oldestDate}&endDate=${businessDate}`, branchId),
          actionLabel: row.status === "submitted" && canApprove ? "مراجعة للاعتماد" : row.status === "draft" && canEdit ? "مراجعة المسودات" : "عرض المتابعة",
          description: row.status === "submitted"
            ? `أقدم يومية: ${row.oldestDate}. مقدمة للمراجع المخول؛ تاريخ اليومية ليس موعد استحقاق. ${canApprove ? "يمكنك مراجعتها للاعتماد أو الرفض." : "عرض متابعة فقط، وليس إجراء اعتماد."}`
            : row.status === "rejected"
            ? `أقدم يومية: ${row.oldestDate}. راجع سبب الرفض مع المراجع؛ لا يدعم المسار الحالي إعادة المرفوضة إلى مسودة.`
            : `أقدم يومية: ${row.oldestDate}. تاريخ اليومية ليس موعد استحقاق؛ الإكمال والتقديم يخضعان لصلاحيات اليومية وحالة الإغلاق.`,
        })),
        statusLabel: rows.length ? "يوميات اليوم" : "لا توجد يوميات اليوم",
        quickActions: await hasEffectiveViewPermission(req, "cashier_journal", "create")
          ? [{ label: "يومية جديدة", href: branchHref("/cashier-journals/new", branchId), kind: "create" as const }]
          : [],
        description: allCashiers ? "أرقام اليوم لكل الكاشيرات؛ المتابعة تشمل المسودات والمرفوضة والمقدمة حتى اليوم." : "يومياتك فقط؛ المتابعة تشمل المسودات والمرفوضة والمقدمة حتى اليوم." };
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
      const awaitingSupplier = ["pending", "approved"].map(status => ({
        status, value: rows.filter(r => r.destination === branchId && r.status === status).reduce((sum, r) => sum + Number(r.value), 0),
      }));
      // Warehouse receipt uses warehouse/edit and destination scope, not kitchen routing.
      // This summary's branch is already authorized by canAccessBranch above.
      const canReceive = incoming > 0 && await hasEffectiveViewPermission(req, "warehouse", "edit");
      return { metrics: [{ label: "واردة بانتظار الاستلام", value: incoming }, { label: "تحويلات صادرة مفتوحة", value: outgoing }],
        alerts: [...(incoming ? [{ label: canReceive ? "تحويلات يمكنك استلامها" : "تحويلات واردة بانتظار مستلم مخول", count: incoming, href: branchHref("/transfer-requests?status=in_transit&direction=incoming", branchId),
          priority: "normal" as const, actionLabel: canReceive ? "تأكيد الاستلام" : "عرض المتابعة",
          description: "تحويلات مرسلة إلى الفرع؛ تأكيد الاستلام بعد التحقق من الوصول وبصلاحية التعديل فقط." }] : []),
          ...awaitingSupplier.filter(row => row.value > 0).map(row => ({
            label: row.status === "pending" ? "تحويلات واردة بانتظار الاعتماد" : "تحويلات واردة بانتظار الإرسال",
            count: row.value, href: branchHref(`/transfer-requests?status=${row.status}&direction=incoming`, branchId),
            priority: "low" as const, actionLabel: "عرض المتابعة",
            description: "متابعة مع جهة التوريد؛ لم ترسل بعد ولا يمكن تأكيد استلامها.",
          }))],
        description: "سجل تحويلات المواد مستقل عن طلبات المطبخ؛ الاستلام للفرع الوجهة فقط.",
        quickActions: [
          ...(await hasEffectiveViewPermission(req, "warehouse", "create")
            ? [{ label: "طلب تحويل جديد", href: branchHref("/transfer-requests?intent=create&from=branch-operations", branchId), kind: "create" as const }] : []),
          ...(canReceive ? [{ label: "استلام تحويلات واردة", href: branchHref("/transfer-requests?status=in_transit&direction=incoming", branchId), kind: "receive" as const }] : []),
        ] };
    } },
  { id: "attendance", title: "الحضور والورديات", group: "people", module: "attendance", href: "/employee-attendance-report",
    load: async (branchId, businessDate, req) => {
      const canReadSchedules = await hasEffectiveViewPermission(req, "shifts");
      // Resolve all legacy identities against a real profile, including transferred
      // staff. Only attendance/schedules from the authorized branch are read.
      const identity = (table: typeof employeeSchedules | typeof attendanceRecords) =>
        eq(branchEmployees.id, sql<number>`coalesce(${table.branchEmployeeId},
          case when ${table.employeeId} ~ '^branch_emp_[0-9]+$'
            then substring(${table.employeeId} from 12)::integer end,
          (select be.id from branch_employees be where be.linked_user_id = ${table.employeeId} limit 1))`);
      const [schedules, records] = await Promise.all([
        canReadSchedules ? db.select({ id: employeeSchedules.id, branchId: employeeSchedules.branchId, scheduleDate: employeeSchedules.scheduleDate,
          canonicalId: branchEmployees.id, startTime: employeeSchedules.startTime, isOff: employeeSchedules.isOff, status: employeeSchedules.status })
          .from(employeeSchedules).leftJoin(branchEmployees, identity(employeeSchedules))
          .where(and(eq(employeeSchedules.branchId, branchId), eq(employeeSchedules.scheduleDate, businessDate))) : Promise.resolve([]),
        db.select({ id: attendanceRecords.id, branchId: attendanceRecords.branchId, attendanceDate: attendanceRecords.attendanceDate,
          canonicalId: branchEmployees.id, actualCheckIn: attendanceRecords.actualCheckIn, actualCheckOut: attendanceRecords.actualCheckOut, status: attendanceRecords.status })
          .from(attendanceRecords).leftJoin(branchEmployees, identity(attendanceRecords))
          .where(and(eq(attendanceRecords.branchId, branchId), eq(attendanceRecords.attendanceDate, businessDate))),
      ]);
      const ids = [...new Set(schedules.flatMap(row => row.canonicalId == null ? [] : [row.canonicalId]))];
      const leaves = ids.length ? await db.select({ id: leaveRequests.branchEmployeeId }).from(leaveRequests)
        .where(and(inArray(leaveRequests.branchEmployeeId, ids), eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, businessDate), gte(leaveRequests.endDate, businessDate))) : [];
      const summary = summarizeBranchAttendance(branchId, businessDate, new Date(), schedules, records, leaves.map(row => row.id));
      return {
        statusLabel: !canReadSchedules ? "الحضور المسجل؛ الجدولة تتطلب صلاحية الورديات" : !schedules.length ? "لا توجد جدولة محفوظة اليوم" : "الجدولة والحضور المسجل اليوم",
        metrics: [
          ...(canReadSchedules ? [
            { label: "مجدولون للعمل (بعد استبعاد الإجازات)", value: summary.scheduled },
            { label: "حضور مسجل من المجدولين", value: summary.scheduledArrived },
            { label: "لم يبدأ موعدهم بعد", value: summary.future },
            { label: "جدولة بلا وقت صالح", value: summary.unknownTime },
          ] : []),
          { label: "إجمالي حضور مسجل بهوية موحدة", value: summary.arrived },
          { label: "حضور دون انصراف مسجل", value: summary.open },
          { label: "سجلات بهوية غير مرتبطة", value: summary.unresolved },
        ],
        alerts: summary.awaiting ? [{ label: "بدأ موعدهم دون حضور مسجل", count: summary.awaiting,
          href: branchHref(`/employee-attendance-report?startDate=${businessDate}&endDate=${businessDate}`, branchId),
          priority: "normal", dueAt: summary.oldestDue, actionLabel: "مراجعة الحضور",
          description: "أقدم بداية دوام محفوظة؛ ليست إثبات غياب أو خصماً. تحقق من الإدخال والهوية والجدولة." }] : [],
        description: "اليوم حسب توقيت السعودية. التغطية تخص الجدولة المحفوظة فقط، لا جميع العاملين. السجلات غير المرتبطة لا تدخل الأعداد الموحدة؛ تعذر المصدر يظهر خطأ لا صفراً.",
      };
    } },
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
            actionLabel: "عرض المتابعة", description: `عرض الوثائق المنتهية؛ تعديلها يتطلب صلاحية مستقلة.${result.stats.oldestExpiredDate ? ` أقدم انتهاء: ${result.stats.oldestExpiredDate}.` : ""}` }] : []),
          ...(soonCount ? [{ label: "وثائق قاربت على الانتهاء", count: soonCount, href: hrefFor("expiring_soon"), priority: "low" as const,
            actionLabel: "عرض المتابعة", description: `تنبيه مبكر للوثائق التي تنتهي خلال 30 يوماً، وليس إجراءً متأخراً.${result.stats.oldestExpiringSoonDate ? ` أقرب انتهاء: ${result.stats.oldestExpiringSoonDate}.` : ""}` }] : []),
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

    if (!(await canAccessBranch(req, branchId))) {
      return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
    }
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1);
    if (!branch) {
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