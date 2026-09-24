import type { OperationCard } from "./presentation";

/** Sample-only branch board. No fixture values are fetched from the customer's backend. */
export type BranchOperationsSummary = {
  branchId: string;
  generatedAt: string;
  businessDate: string;
  cards: OperationCard[];
};

export const sampleBranch = { id: "sample-madinah", name: "المدينة المنورة" } as const;
const branchId = sampleBranch.id;
const link = (path: string) => `${path}${path.includes("?") ? "&" : "?"}branchId=${branchId}`;

export const sampleBoard: BranchOperationsSummary = {
  branchId,
  businessDate: "2026-02-26",
  generatedAt: "2026-02-26T10:30:00.000Z",
  cards: [
    { id: "maintenance", title: "الصيانة", group: "operations", href: link("/maintenance"), state: "error", metrics: [], alerts: [] },
    { id: "complaints", title: "شكاوى الفروع", group: "operations", href: link("/branch-complaints"), state: "error", metrics: [], alerts: [] },
    { id: "waste", title: "الهدر", group: "operations", href: link("/display-bar-waste"), state: "ready",
      metrics: [{ label: "سجلات هدر اليوم", value: 0 }], alerts: [],
      description: "معلومة عن الهدر المسجل اليوم، وليست مهاماً معلقة." },
    { id: "purchasing", title: "المشتريات", group: "operations", href: link("/purchasing-requests"), state: "error", metrics: [], alerts: [] },
    { id: "kitchen", title: "طلبات المطبخ", group: "operations", href: link("/central-kitchen-orders"), state: "error", metrics: [], alerts: [] },
    { id: "closing", title: "الإغلاق اليومي", group: "operations", href: link("/branch-daily-closing"), state: "ready",
      statusLabel: "لم يبدأ إغلاق اليوم", metrics: [{ label: "إغلاقات سابقة غير مكتملة", value: 196 }],
      alerts: [{ label: "إغلاقات سابقة غير مكتملة", count: 196, href: link("/branch-daily-closing?date=2025-07-01"), priority: "high", actionLabel: "عرض المتابعة",
        description: "أقدم سجل غير مكتمل: 2025-07-01؛ تاريخ السجل وليس موعد إغلاق محدداً." }],
      description: "عدم وجود سجل اليوم ليس تأخراً؛ لا يوجد موعد إغلاق ثابت معتمد." },
    { id: "targets", title: "الأهداف", group: "sales", href: link("/targets-dashboard"), state: "ready",
      metrics: [], alerts: [], statusLabel: "لا يوجد هدف يومي معتمد",
      description: "من التوزيع اليومي الفعلي فقط؛ لا يتم تقسيم الهدف الشهري تلقائياً." },
    { id: "sales", title: "المبيعات", group: "sales", href: link("/sales-analytics"), state: "ready",
      metrics: [], alerts: [], statusLabel: "لا توجد يوميات معتمدة اليوم",
      description: "نفس مصدر تحليلات المبيعات، وليس إجمالي مبيعات نقاط البيع المباشر." },
    { id: "cashier", title: "يوميات الكاشير", group: "sales", href: link("/cashier-journals"), state: "error", metrics: [], alerts: [] },
    { id: "warehouse", title: "تحويلات المستودع", group: "operations", href: link("/transfer-requests"), state: "error", metrics: [], alerts: [] },
    { id: "attendance", title: "الحضور والورديات", group: "people", href: link("/employee-attendance-report"), state: "error", metrics: [], alerts: [] },
    { id: "employees", title: "الموظفون", group: "people", href: link("/branch-employees"), state: "error", metrics: [], alerts: [] },
    { id: "documents", title: "وثائق الموظفين", group: "people", href: link("/hr/employee-documents"), state: "ready",
      metrics: [{ label: "منتهية", value: 10 }, { label: "تنتهي خلال 30 يوماً", value: 0 }],
      alerts: [{ label: "وثائق منتهية", count: 10, href: link("/hr/employee-documents?status=expired&activeOnly=true"), priority: "high",
        actionLabel: "عرض المتابعة", description: "عرض الوثائق المنتهية؛ تعديلها يتطلب صلاحية مستقلة." }] },
    { id: "advances", title: "السلف", group: "people", href: link("/hr/advances"), state: "error", metrics: [], alerts: [] },
  ],
};