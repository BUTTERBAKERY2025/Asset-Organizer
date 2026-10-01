import type { OperationCard } from "../_source/client/src/components/branch-operations/presentation";

/** Explicitly synthetic, non-sensitive fixture data. Never customer/backend data. */
export const syntheticBranch = { id: "synthetic-preview-branch", name: "فرع المعاينة · بيانات تجريبية" };
export const syntheticBranches = [syntheticBranch];
const href = (route: string) => `${route}${route.includes("?") ? "&" : "?"}branchId=${syntheticBranch.id}`;
const card = (id: string, title: string, group: string, route: string, metrics: OperationCard["metrics"], alerts: OperationCard["alerts"] = [], quickActions?: OperationCard["quickActions"]): OperationCard => ({
  id, title, group, href: href(route), state: "ready", metrics, alerts, quickActions,
});

export const syntheticBoard = {
  branchId: syntheticBranch.id,
  generatedAt: "2026-09-22T10:30:00.000Z",
  businessDate: "2026-09-22",
  cards: [
    card("kitchen", "طلبات المطبخ", "orders", "/central-kitchen-orders",
      [{ label: "طلبات اليوم", value: 4 }, { label: "جاهزة للاستلام", value: 2 }],
      [{ label: "طلبات جاهزة للاستلام", count: 2, href: href("/central-kitchen-orders?stage=dispatched"), priority: "high", description: "متابعة تجريبية للاستلام؛ ليست شحنة فعلية." }],
      [{ label: "طلب جديد", href: href("/central-kitchen-orders?intent=create"), kind: "create" }, { label: "استلام الطلبات", href: href("/central-kitchen-orders?stage=dispatched"), kind: "receive" }]),
    card("warehouse", "تحويلات المستودع", "orders", "/transfer-requests",
      [{ label: "تحويلات واردة", value: 3 }], [],
      [{ label: "طلب مواد", href: href("/transfer-requests?intent=create"), kind: "create" }, { label: "استلام المواد", href: href("/transfer-requests?status=in_transit&direction=incoming"), kind: "receive" }]),
    card("purchasing", "المشتريات", "orders", "/purchasing-requests",
      [{ label: "طلبات قيد المتابعة", value: 2 }]),
    card("cashier", "يوميات الكاشير", "sales", "/cashier-journals",
      [{ label: "يوميات معتمدة", value: 3 }, { label: "قيد المراجعة", value: 1 }],
      [{ label: "يوميات قيد المراجعة", count: 1, href: href("/cashier-journals?status=pending"), priority: "normal" }],
      [{ label: "يومية جديدة", href: href("/cashier-journals/new"), kind: "create" }]),
    card("sales", "المبيعات", "sales", "/sales-analytics",
      [{ label: "مبيعات اليوميات المعتمدة والمرحلة", value: 8640, unit: "ر.س" }]),
    card("targets", "الأهداف", "sales", "/targets-dashboard",
      [{ label: "هدف اليوم المعتمد", value: 12000, unit: "ر.س" }]),
    card("closing", "الإغلاق اليومي", "sales", "/branch-daily-closing",
      [{ label: "إغلاقات سابقة غير مكتملة", value: 1 }],
      [{ label: "إغلاق سابق غير مكتمل", count: 1, href: href("/branch-daily-closing?date=2026-09-21"), priority: "high", description: "سجل تجريبي لمراجعة عرض المتابعة." }],
      [{ label: "فتح الإغلاق", href: href("/branch-daily-closing?intent=create"), kind: "create" }]),
    card("attendance", "الحضور والورديات", "sales", "/employee-attendance-report",
      [{ label: "حضور اليوم", value: 12 }, { label: "وردية مفتوحة", value: 1 }]),
    card("complaints", "شكاوى الفروع", "operations", "/branch-complaints",
      [{ label: "شكاوى مفتوحة", value: 2 }],
      [{ label: "شكاوى تحتاج متابعة", count: 2, href: href("/branch-complaints?status=open"), priority: "normal" }],
      [{ label: "تسجيل شكوى", href: href("/branch-complaints?intent=create"), kind: "create" }]),
    card("maintenance", "الصيانة", "operations", "/maintenance",
      [{ label: "بلاغات مفتوحة", value: 1 }],
      [{ label: "بلاغ صيانة عاجل", count: 1, href: href("/maintenance?status=open"), priority: "critical", description: "بلاغ تجريبي؛ لا أصل أو عطل فعلي." }],
      [{ label: "بلاغ جديد", href: href("/maintenance?intent=create"), kind: "create" }]),
    card("waste", "الهدر", "operations", "/display-bar-waste",
      [{ label: "سجلات هدر اليوم", value: 2 }], [],
      [{ label: "تسجيل هدر", href: href("/display-bar-waste?tab=waste"), kind: "create" }]),
    card("employees", "الموظفون", "people", "/branch-employees",
      [{ label: "موظفون نشطون", value: 14 }]),
    card("documents", "وثائق الموظفين", "people", "/hr/employee-documents",
      [{ label: "تنتهي خلال 30 يوماً", value: 1 }],
      [{ label: "وثائق تنتهي قريباً", count: 1, href: href("/hr/employee-documents?status=expiring"), priority: "normal" }]),
    card("advances", "السلف", "people", "/hr/advances",
      [{ label: "طلبات قيد المراجعة", value: 1 }]),
  ] satisfies OperationCard[],
};