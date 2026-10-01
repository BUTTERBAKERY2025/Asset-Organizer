import { branchDeskDate } from "./branch-operation-navigation";

const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;
const contextKeys = [
  "from", "centerBranchIds", "centerWorkspace", "centerMonth", "centerMonthBranchId", "centerMonthFile",
  "branchReturn",
] as const;

/** A day is navigation intent, never authorization or permission to create a record. */
export function dailyClosureIntent(search: string) {
  const params = new URLSearchParams(search);
  const requestedDate = params.get("date");
  const date = branchDeskDate(requestedDate);
  const requestedMonth = params.get("month") || "";
  const month = monthPattern.test(requestedMonth) ? requestedMonth : "";
  const invalidDate = requestedDate !== null && (!date || (!!month && !date.startsWith(`${month}-`)));
  return { date: invalidDate ? "" : date, month, invalidDate };
}

export function dailyClosureDateRange(search: string) {
  const intent = dailyClosureIntent(search);
  if (intent.invalidDate) return { startDate: "", endDate: "" };
  if (intent.date) return { startDate: intent.date, endDate: intent.date };
  if (!intent.month) return { startDate: "", endDate: "" };
  const [year, month] = intent.month.split("-").map(Number);
  return {
    startDate: `${intent.month}-01`,
    endDate: `${intent.month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`,
  };
}

/** Only fixed daily destinations; copy return metadata, never a caller-controlled return URL. */
export function dailyClosureHref(
  destination: "list" | "create" | number,
  search: string,
  branchId: string,
  date?: string,
  month?: string,
) {
  if (typeof destination === "number" && (!Number.isSafeInteger(destination) || destination < 1)) {
    throw new Error("معرف إغلاق غير صالح");
  }
  const input = new URLSearchParams(search);
  const output = new URLSearchParams();
  for (const key of contextKeys) {
    const value = input.get(key);
    if (value) output.set(key, value);
  }
  if (branchId && branchId !== "all") output.set("branchId", branchId);
  const selectedDate = date === undefined ? input.get("date") || "" : date;
  const selectedMonth = month === undefined ? input.get("month") || "" : month;
  if (selectedDate) {
    if (!branchDeskDate(selectedDate)) throw new Error("تاريخ الإغلاق غير صالح");
    output.set("date", selectedDate);
  }
  if (selectedMonth) {
    if (!monthPattern.test(selectedMonth)) throw new Error("شهر الإغلاق غير صالح");
    output.set("month", selectedMonth);
  }
  const path = destination === "list" ? "/branch-daily-closures"
    : destination === "create" ? "/branch-daily-closing" : `/branch-daily-closures/${destination}`;
  return `${path}${output.size ? `?${output}` : ""}`;
}

export function dailyClosureScopeReady(
  branchId: string, allowedIds: readonly string[], branchesLoading: boolean,
  hasBranchParam: boolean, resolving: boolean, linkedBranchId: string | null, canSelectBranch: boolean,
) {
  return !branchesLoading && !resolving && !!branchId && allowedIds.length > 0
    && (branchId === "all" ? canSelectBranch && !hasBranchParam : allowedIds.includes(branchId))
    && (!hasBranchParam || branchId === linkedBranchId);
}

/** Recheck at confirmation time, including a dialog left open across a scope change. */
export function canApproveDailyClosure(
  closure: { branchId: string; createdBy: string; status: string; closureDate: string },
  context: {
    actorId?: string; permitted: boolean; scopeReady: boolean; pending: boolean; fetching: boolean;
    allowedIds: readonly string[]; branchId: string; startDate: string; endDate: string;
  },
) {
  return context.permitted && context.scopeReady && !context.pending && !context.fetching
    && !!context.actorId && !!closure.createdBy && closure.createdBy !== context.actorId
    && closure.status === "open" && context.allowedIds.includes(closure.branchId)
    && (context.branchId === "all" || closure.branchId === context.branchId)
    && (!context.startDate || closure.closureDate >= context.startDate)
    && (!context.endDate || closure.closureDate <= context.endDate);
}