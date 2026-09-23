/** Fixed internal destinations only; never accept a caller-controlled return URL. */
export const BRANCH_OPERATION_ROUTES = [
  { path: "/sales-analytics", id: "sales", label: "المبيعات", section: "المبيعات والأهداف" },
  { path: "/targets-dashboard", id: "targets", label: "الأهداف", section: "المبيعات والأهداف" },
  { path: "/branch-daily-closing", id: "closing", label: "الإغلاق اليومي", section: "المبيعات والأهداف" },
  { path: "/central-kitchen-orders", id: "kitchen", label: "طلبات المطبخ", section: "الطلبيات والمخزون" },
  { path: "/purchasing-requests", id: "purchasing", label: "المشتريات", section: "الطلبيات والمخزون" },
  { path: "/display-bar-waste", id: "waste", label: "الهدر", section: "الطلبيات والمخزون" },
  { path: "/maintenance", id: "maintenance", label: "الصيانة", section: "تشغيل الفرع" },
  { path: "/branch-complaints", id: "complaints", label: "شكاوى الفروع", section: "تشغيل الفرع" },
  { path: "/branch-employees", id: "employees", label: "الموظفون", section: "الفريق والملفات" },
  { path: "/hr/employee-documents", id: "documents", label: "وثائق الموظفين", section: "الفريق والملفات" },
  { path: "/hr/advances", id: "advances", label: "السلف", section: "الفريق والملفات" },
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