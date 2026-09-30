/** Saudi business month, defaulting to the last completed month rather than today's open month. */
export function lastCompletedOperationsMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
}

export const monthMoney = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ر.س`
    : "غير متاح";

/** The server owns provenance; never let a source link change the selected branch/month. */
export function validMonthSource(href: string, branchId: string, month: string, origin: string): boolean {
  try {
    const url = new URL(href, origin);
    const branchParameter = url.pathname === "/salary-closing" ? "branch" : "branchId";
    return url.origin === origin &&
      ["/salary-closing", "/hr-hub", "/pnl-dashboard", "/branch-daily-closures", "/sales-analytics"].includes(url.pathname) &&
      (url.pathname !== "/hr-hub" || url.searchParams.get("tab") === "payroll") &&
      (url.pathname !== "/salary-closing" || !url.searchParams.has("branchId") || url.searchParams.get("branchId") === branchId) &&
      url.searchParams.get(branchParameter) === branchId &&
      url.searchParams.get("month") === month;
  } catch { return false; }
}