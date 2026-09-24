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
  if (path === "/cashier-journals/new") return BRANCH_OPERATION_ROUTES.find(route => route.id === "cashier");
  return BRANCH_OPERATION_ROUTES.find((route) => route.path === path);
}

/** Intent is a UI selection, never authorization or an automatic mutation. */
export function branchDeskActionUrl(href: string, intent: "create" | "receive") {
  const url = new URL(href, "https://internal.invalid");
  if (url.pathname === "/cashier-journals" && intent === "create") {
    url.pathname = "/cashier-journals/new";
  } else if (url.pathname === "/display-bar-waste" && intent === "create") {
    url.searchParams.set("tab", "waste");
  } else if (url.pathname === "/central-kitchen-orders" && intent === "receive") {
    url.searchParams.set("stage", "dispatched");
  } else if (url.pathname === "/transfer-requests" && intent === "receive") {
    url.searchParams.set("status", "in_transit");
    url.searchParams.set("direction", "incoming");
  } else {
    url.searchParams.set("intent", intent);
  }
  return `${url.pathname}${url.search}`;
}

export function branchDeskDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

/** Keep the return breadcrumb in sync when a destination's selector changes. */
export function updateBranchDeskScope(branchId: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("from") !== "branch-operations") return;
  if (branchId === "all") {
    url.searchParams.delete("branchId");
    url.searchParams.delete("from");
  } else url.searchParams.set("branchId", branchId);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
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