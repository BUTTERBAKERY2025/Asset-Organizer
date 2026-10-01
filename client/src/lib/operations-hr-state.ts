export const validOperationsPayrollMonth = (month: string) =>
  /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);

/** The URL is the selection source of truth, including same-mounted-page navigation. */
export function operationsHrSelectionIntent(search: string, defaultMonth: string) {
  const params = new URLSearchParams(search);
  return {
    branchId: params.getAll("branchId").length > 1
      || (params.has("branchId") && (!/^[\w-]{1,80}$/.test(params.get("branchId") || "") || params.get("branchId")?.toLowerCase() === "all"))
      || (params.get("from") === "operations-center" && !params.has("branchId"))
      ? "__invalid_scope__" : params.get("branchId") || "",
    month: params.has("month") ? params.get("month")! : defaultMonth,
    tab: params.get("tab") === "payroll" ? "payroll" as const : "employees" as const,
  };
}

/** Keep the source breadcrumb's intent in sync without changing its authorized scope. */
export function operationsHrSelectionHref(
  pathname: string, search: string, branchId: string, month: string,
  tab: "employees" | "payroll", allowedIds: readonly string[],
) {
  const params = new URLSearchParams(search);
  const allowedBranch = allowedIds.includes(branchId);
  if (allowedBranch) params.set("branchId", branchId);
  else if (branchId) params.set("branchId", branchId); // Preserve explicit denied intent; never substitute.
  else params.delete("branchId");
  params.set("tab", tab);
  // Keep explicit invalid/blank input so refresh or external navigation cannot
  // silently substitute another month. Queries/actions validate independently.
  params.set("month", month);
  if (params.get("from") === "operations-center" && params.get("centerWorkspace") === "monthly") {
    if (allowedBranch && validOperationsPayrollMonth(month)) {
      params.set("centerMonthBranchId", branchId);
      params.set("centerMonth", month);
    } else {
      params.delete("centerMonthBranchId");
      params.delete("centerMonth");
    }
  }
  if (params.get("centerWorkspace") === "people" && params.getAll("centerWorkspace").length === 1) {
    if (branchId !== params.get("branchId") || branchId !== params.get("centerPeopleBranchId")) {
      params.delete("offerId");
      params.delete("notificationId");
      params.delete("centerPeopleRecord");
    }
    params.set("centerPeopleBranchId", branchId);
    if (tab === "payroll") {
      params.delete("offerId");
      params.delete("notificationId");
      params.delete("centerPeopleRecord");
    }
  }
  return `${pathname}${params.size ? `?${params}` : ""}`;
}

/** A→B→A is a new selection, not permission to display the first A command's result. */
export function createOperationsHrCommandGuard() {
  let scope = "";
  let generation = 0;
  return {
    update(next: string) {
      if (next !== scope) { scope = next; generation++; }
    },
    capture: () => generation,
    isCurrent: (token: number) => token === generation,
    invalidate: () => { generation++; },
  };
}

export function operationsPayrollReportReady(input: {
  authorizedBranch: boolean; month: string; fetching: boolean; error: boolean; hasData: boolean;
}) {
  return input.authorizedBranch && validOperationsPayrollMonth(input.month) &&
    !input.fetching && !input.error && input.hasData;
}