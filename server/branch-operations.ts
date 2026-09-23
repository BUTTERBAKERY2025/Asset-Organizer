import type { Express, Request } from "express";
import { and, count, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import {
  advanceRequests,
  branchDailyClosures,
  branchComplaints,
  branchEmployees,
  branches,
  branchShifts,
  centralKitchenOrders,
  dailyWasteLog,
  employeeDocuments,
  purchasingRequests,
} from "@shared/schema";
import type {
  BranchOperationsCard,
  BranchOperationsSummaryResponse,
} from "@shared/branch-operations";
import { db } from "./db";
import { storage } from "./storage";
import { readEmployeeDocumentMetadata } from "./employee-documents-read";
import {
  BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS,
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
  load: (branchId: string, businessDate: string) => Promise<Pick<BranchOperationsCard, "metrics" | "alerts" | "actions">>;
}

const branchHref = (path: string, branchId: string) =>
  `${path}${path.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`;

const emptyData = async () => ({ metrics: [], alerts: [] });

const definitions: CardDefinition[] = [
  { id: "maintenance", title: "الصيانة", group: "operations", module: "maintenance", href: "/maintenance", load: emptyData },
  {
    id: "complaints", title: "شكاوى الفروع", group: "operations", module: "branch_complaints", href: "/branch-complaints",
    load: async (branchId) => {
      const now = new Date();
      const [[open], [overdue]] = await Promise.all([
        db.select({ value: count() }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId),
          inArray(branchComplaints.status, ["open", "in_progress", "resolved"]),
        )),
        db.select({ value: count() }).from(branchComplaints).where(and(
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
        metrics: [{ label: "شكاوى مفتوحة", value: openCount }, { label: "تجاوزت موعد الرد", value: overdueCount }],
        alerts: overdueCount ? [{ label: "شكاوى متأخرة بلا رد أول", count: overdueCount, href }] : [],
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
        alerts: value ? [{ label: "هدر مسجل اليوم", count: value, href: branchHref("/display-bar-waste", branchId) }] : [],
      };
    },
  },
  {
    id: "purchasing", title: "المشتريات", group: "operations", module: "warehouse", href: "/purchasing-requests",
    load: async (branchId) => {
      const [row] = await db.select({ value: count() }).from(purchasingRequests)
        .where(and(eq(purchasingRequests.branchId, branchId), eq(purchasingRequests.status, "pending")));
      const value = Number(row?.value || 0);
      return {
        metrics: [{ label: "طلبات معلقة", value }],
        alerts: value ? [{ label: "طلبات بانتظار المعالجة", count: value, href: branchHref("/purchasing-requests", branchId) }] : [],
      };
    },
  },
  {
    id: "kitchen", title: "طلبات المطبخ", group: "operations", module: "central_kitchen_orders", href: "/central-kitchen-orders",
    load: async (branchId) => {
      const rows = await db.select({ status: centralKitchenOrders.status, value: count() })
        .from(centralKitchenOrders)
        .where(and(
          eq(centralKitchenOrders.requestBranchId, branchId),
          inArray(centralKitchenOrders.status, ["requested", "approved", "prepared", "dispatched"]),
        ))
        .groupBy(centralKitchenOrders.status);
      const counts = new Map(rows.map((row) => [row.status, Number(row.value)]));
      const incoming = counts.get("dispatched") || 0;
      const open = rows.reduce((total, row) => total + Number(row.value), 0);
      return {
        metrics: [{ label: "طلبات مفتوحة", value: open }, { label: "في طريقها للفرع", value: incoming }],
        alerts: incoming ? [{ label: "طلبات بانتظار الاستلام", count: incoming, href: branchHref("/central-kitchen-orders", branchId) }] : [],
      };
    },
  },
  {
    id: "closing", title: "الإغلاق اليومي", group: "operations", module: "daily_closures", href: "/branch-daily-closing",
    load: async (branchId, businessDate) => {
      const [closure] = await db.select({ status: branchDailyClosures.status }).from(branchDailyClosures)
        .where(and(eq(branchDailyClosures.branchId, branchId), eq(branchDailyClosures.closureDate, businessDate)))
        .limit(1);
      const pending = !closure || closure.status !== "closed";
      const href = branchHref("/branch-daily-closing", branchId);
      return {
        metrics: [{ label: "إغلاق اليوم مكتمل", value: pending ? 0 : 1 }],
        alerts: pending ? [{ label: closure ? "إغلاق اليوم قيد الإكمال" : "لم يسجل إغلاق اليوم", count: 1, href }] : [],
        actions: pending ? [{ label: closure ? "إكمال الإغلاق" : "بدء الإغلاق", href }] : undefined,
      };
    },
  },
  { id: "targets", title: "الأهداف", group: "sales", module: "targets", href: "/targets-dashboard", load: emptyData },
  { id: "sales", title: "المبيعات", group: "sales", module: "sales_analytics", href: "/sales-analytics", load: emptyData },
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
          ...(expiredCount ? [{ label: "وثائق منتهية", count: expiredCount, href: hrefFor("expired") }] : []),
          ...(soonCount ? [{ label: "وثائق قاربت على الانتهاء", count: soonCount, href: hrefFor("expiring_soon") }] : []),
        ],
      };
    },
  },
  {
    id: "advances", title: "السلف", group: "people", module: "hr_advances", href: "/hr/advances",
    load: async (branchId) => {
      const [row] = await db.select({ value: count() }).from(advanceRequests)
        .where(and(
          eq(advanceRequests.branchId, branchId),
          inArray(advanceRequests.status, ["pending", "pre_approved", "awaiting_signature", "signed", "approved"]),
        ));
      const value = Number(row?.value || 0);
      return {
        metrics: [{ label: "طلبات قيد الإجراء", value }],
        alerts: value ? [{ label: "طلبات سلف قيد الإجراء", count: value, href: branchHref("/hr/advances", branchId) }] : [],
      };
    },
  },
];

async function hasEffectiveViewPermission(req: Request, module: string): Promise<boolean> {
  const user = req.currentUser;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "attendance_clerk") return false;
  if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)) return true;
  if (user.role === "hr_specialist" && HR_SPECIALIST_PERMISSIONS[module]?.includes("view")) return true;
  if (user.role === "production_development_manager" && PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module]?.includes("view")) return true;
  if (user.role === "financial_manager") {
    const actions = FINANCIAL_MANAGER_PERMISSIONS[module]
      || (module === "pnl" ? FINANCIAL_MANAGER_PERMISSIONS.pnl_dashboard : undefined)
      || (module === "pnl_dashboard" ? FINANCIAL_MANAGER_PERMISSIONS.pnl : undefined);
    if (actions?.includes("view")) return true;
  }
  if (user.role === "operations_manager") {
    const alias = module === "waste_tracking" ? "waste" : module === "waste" ? "waste_tracking" : module;
    if ((OPERATIONS_MANAGER_PERMISSIONS[module] || OPERATIONS_MANAGER_PERMISSIONS[alias])?.includes("view")) return true;
  }
  if (user.role === "branch_manager" && module === "central_kitchen_orders"
      && BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS.includes("view")) return true;
  return storage.hasPermission(user.id, module, "view");
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
      definition.load(branchId, businessDate)));
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