/** Fixed internal destinations only; never accept a caller-controlled return URL. */
export const BRANCH_OPERATION_ROUTES = [
  { path: "/cashier-journals", id: "cashier", label: "يومية الكاشير", section: "الوردية والمبيعات والإغلاق" },
  { path: "/employee-attendance-report", id: "attendance", label: "الحضور والانصراف", section: "الوردية والمبيعات والإغلاق" },
  { path: "/sales-analytics", id: "sales", label: "المبيعات", section: "الوردية والمبيعات والإغلاق" },
  { path: "/targets-dashboard", id: "targets", label: "الأهداف", section: "الوردية والمبيعات والإغلاق" },
  { path: "/branch-daily-closing", id: "closing", label: "الإغلاق اليومي", section: "الوردية والمبيعات والإغلاق" },
  { path: "/central-kitchen-orders", id: "kitchen", label: "طلبات المطبخ", section: "التوريد والاستلام" },
  { path: "/transfer-requests", id: "warehouse", label: "تحويلات المستودع", section: "التوريد والاستلام" },
  { path: "/purchasing-requests", id: "purchasing", label: "المشتريات", section: "التوريد والاستلام" },
  { path: "/display-bar-waste", id: "waste", label: "الهدر", section: "مشكلات الفرع" },
  { path: "/maintenance", id: "maintenance", label: "الصيانة", section: "مشكلات الفرع" },
  { path: "/branch-complaints", id: "complaints", label: "شكاوى الفروع", section: "مشكلات الفرع" },
  { path: "/branch-employees", id: "employees", label: "الموظفون", section: "الفريق والمتابعات الإدارية" },
  { path: "/hr/employee-documents", id: "documents", label: "وثائق الموظفين", section: "الفريق والمتابعات الإدارية" },
  { path: "/hr/advances", id: "advances", label: "السلف", section: "الفريق والمتابعات الإدارية" },
] as const;

export function branchOperationDestination(path: string) {
  return BRANCH_OPERATION_ROUTES.find((route) => route.path === path);
}

export function branchOperationUrl(href: string, branchId: string) {
  const base = "https://internal.invalid";
  const url = new URL(href, base);
  if (url.origin !== base || !branchOperationDestination(url.pathname)) {
    throw new Error("مسار غير معتمد في لوحة الفرع");
  }
  url.searchParams.set("branchId", branchId);
  url.searchParams.set("from", "branch-operations");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function branchBoardUrl(branchId: string | null, sourcePath?: string) {
  const query = branchId ? `?${new URLSearchParams({ branchId })}` : "";
  const source = sourcePath ? branchOperationDestination(sourcePath) : undefined;
  return `/branch-operations${query}${source ? `#branch-operation-card-${source.id}` : ""}`;
}