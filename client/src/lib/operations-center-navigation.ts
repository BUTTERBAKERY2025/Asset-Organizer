const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;
export const monthFiles = ["payroll", "expenses", "closing", "sales"] as const;
export type MonthFile = typeof monthFiles[number];

export function performanceDaysIntent(search: string, key = "performanceDays"): 7 | 30 | null {
  const values = new URLSearchParams(search).getAll(key);
  if (values.length !== 1) return null;
  return values[0] === "7" ? 7 : values[0] === "30" ? 30 : null;
}

/** Query strings are navigation intent, never evidence of branch authorization. */
export function salaryBranchIntent(search: string) {
  const params = new URLSearchParams(search);
  const branch = params.get("branch");
  const branchId = params.get("branchId");
  const explicit = params.has("branch") || params.has("branchId");
  const conflict = branch !== null && branchId !== null && branch !== branchId;
  return { branch: conflict ? "" : branch ?? branchId ?? "", explicit, conflict };
}

export function monthlyReturnIntent(search: string, allowedIds: readonly string[]) {
  const params = new URLSearchParams(search);
  const requested = params.get("monthBranchId") || "";
  const month = params.get("month") || "";
  const file = params.get("monthFile");
  return {
    monthly: params.get("workspace") === "monthly",
    branchId: allowedIds.includes(requested) ? requested : "",
    month: monthPattern.test(month) ? month : "",
    file: monthFiles.includes(file as MonthFile) ? file as MonthFile : null,
  };
}

export function withMonthlyReturn(href: string, branchId: string, month: string, file: MonthFile | null, origin: string) {
  const url = new URL(href, origin);
  if (url.origin !== origin || !monthPattern.test(month)) throw new Error("Invalid monthly destination");
  url.searchParams.set("centerWorkspace", "monthly");
  url.searchParams.set("centerMonth", month);
  url.searchParams.set("centerMonthBranchId", branchId);
  if (file) url.searchParams.set("centerMonthFile", file);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function attachCenterContext(url: URL, branchId: string, scope: readonly string[], performanceDays?: 7 | 30) {
  if (url.pathname === "/salary-closing") {
    const intent = salaryBranchIntent(url.search);
    if (intent.conflict || (intent.explicit && intent.branch !== branchId)) throw new Error("Conflicting salary branch");
    url.searchParams.set("branch", branchId);
  }
  url.searchParams.set("branchId", branchId);
  url.searchParams.set("from", "operations-center");
  url.searchParams.set("centerBranchIds", scope.join(","));
  if (performanceDays === 7 || performanceDays === 30) url.searchParams.set("centerPerformanceDays", String(performanceDays));
}

export function operationsCenterReturnHref(search: string, allowedIds: readonly string[]) {
  const input = new URLSearchParams(search);
  const params = new URLSearchParams();
  const ids = (input.get("centerBranchIds") || "").split(",").filter(id => allowedIds.includes(id));
  if (ids.length) params.set("branchIds", [...new Set(ids)].join(","));
  const performanceDays = performanceDaysIntent(search, "centerPerformanceDays");
  if (performanceDays !== null) params.set("performanceDays", String(performanceDays));
  const month = input.get("centerMonth") || "";
  const branchId = input.get("centerMonthBranchId") || "";
  if (input.get("centerWorkspace") === "monthly" && monthPattern.test(month) && allowedIds.includes(branchId)) {
    params.set("workspace", "monthly");
    params.set("month", month);
    params.set("monthBranchId", branchId);
    const file = input.get("centerMonthFile");
    if (monthFiles.includes(file as MonthFile)) params.set("monthFile", file!);
  } else if (input.get("centerWorkspace") === "analysis") {
    params.set("workspace", "analysis");
  }
  return `/operations-center${params.size ? `?${params}` : ""}`;
}