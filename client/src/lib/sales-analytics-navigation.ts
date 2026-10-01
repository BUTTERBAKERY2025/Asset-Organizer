export type SalesAnalyticsPeriod = {
  month: string;
  fromDate: string;
  toDate: string;
  exact: boolean;
  error: string | null;
};

export type SalesAnalyticsSelection = {
  search: string;
  period: SalesAnalyticsPeriod;
  branchOverride: string | null;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function salesAnalyticsMonthPeriod(month: string): SalesAnalyticsPeriod {
  if (!monthPattern.test(month)) throw new Error("Invalid analytics month");
  const end = new Date(`${month}-01T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { month, fromDate: `${month}-01`, toDate: end.toISOString().slice(0, 10), exact: false, error: null };
}

/** Explicit range intent must be complete and real; never silently expand it to a month. */
export function salesAnalyticsPeriodIntent(search: string, defaultMonth: string): SalesAnalyticsPeriod {
  const params = new URLSearchParams(search);
  const month = params.get("month") || "";
  const fallback = salesAnalyticsMonthPeriod(monthPattern.test(month) ? month : defaultMonth);
  if (!params.has("fromDate") && !params.has("toDate")) return fallback;
  const from = params.getAll("fromDate");
  const to = params.getAll("toDate");
  const fromDate = from[0] || "";
  const toDate = to[0] || "";
  if (from.length !== 1 || to.length !== 1 || !validDate(fromDate) || !validDate(toDate) || fromDate > toDate) {
    return { ...fallback, fromDate: "", toDate: "", exact: true, error: "فترة التحليل غير صالحة؛ يجب تحديد تاريخ بداية ونهاية صحيحين وبالترتيب." };
  }
  return { month: toDate.slice(0, 7), fromDate, toDate, exact: true, error: null };
}

/** Query-only navigation resets URL-derived filters before a request can use old dates/scope. */
export function salesAnalyticsSelection(search: string, previous: SalesAnalyticsSelection | null, defaultMonth: string): SalesAnalyticsSelection {
  if (previous?.search === search) return previous;
  return { search, period: salesAnalyticsPeriodIntent(search, defaultMonth), branchOverride: null };
}

export function resolveSalesAnalyticsBranch(
  search: string,
  allowedIds: readonly string[],
  userBranchId: string | null | undefined,
  canSelectBranch: boolean,
  override: string | null = null,
) {
  const params = new URLSearchParams(search);
  const requested = params.getAll("branchId");
  const explicit = params.has("branchId");
  if (override !== null) {
    const valid = allowedIds.includes(override) || (override === "all" && canSelectBranch && allowedIds.length > 0);
    return { branchId: valid ? override : "", denied: !valid };
  }
  if (explicit) {
    const valid = requested.length === 1 && requested[0] !== "all" && allowedIds.includes(requested[0]);
    return { branchId: valid ? requested[0] : "", denied: !valid };
  }
  if (userBranchId && allowedIds.includes(userBranchId)) return { branchId: userBranchId, denied: false };
  return { branchId: canSelectBranch && allowedIds.length > 0 ? "all" : "", denied: false };
}

export function salesAnalyticsRequestParams(
  period: SalesAnalyticsPeriod,
  branchId: string,
  status = "all",
  discrepancyType = "all",
  groupBy?: string,
) {
  if (period.error || !validDate(period.fromDate) || !validDate(period.toDate) || period.fromDate > period.toDate) {
    throw new Error("Invalid analytics period");
  }
  if (!branchId) throw new Error("An authorized analytics branch is required");
  const params = new URLSearchParams({ fromDate: period.fromDate, toDate: period.toDate });
  if (branchId !== "all") params.set("branchId", branchId);
  if (status !== "all") params.set("status", status);
  if (discrepancyType !== "all") params.set("discrepancyType", discrepancyType);
  if (groupBy) params.set("groupBy", groupBy);
  return params;
}