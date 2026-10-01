import { parseNoticeAction } from "@shared/operations-center-notifications";
import type { QueryClient } from "@tanstack/react-query";

export const operationsCenterQueryRoots = ["/api/operations-center", "/api/operations-center/supply", "/api/operations-center/people", "/api/operations-center/notifications", "/api/operations-center/month-workflow", "/api/operations-center/monthly"] as const;
export function purgeOperationsCenterQueries(client: Pick<QueryClient, "cancelQueries" | "removeQueries">) {
  for (const endpoint of operationsCenterQueryRoots) {
    void client.cancelQueries({ queryKey: [endpoint] });
    client.removeQueries({ queryKey: [endpoint] });
  }
}
export function refreshOperationsCenterQueries(client: Pick<QueryClient, "invalidateQueries">, cancelRefetch = true) {
  for (const endpoint of operationsCenterQueryRoots)
    void client.invalidateQueries({ queryKey: [endpoint] }, { cancelRefetch });
}

const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;
export const monthFiles = ["payroll", "expenses", "closing", "sales"] as const;
export type MonthFile = typeof monthFiles[number];

const supplyRecordPattern = /^(kitchen_order|transfer|reverse_movement|delivery_assignment):([1-9]\d*)$/;
function supplyRecordIntent(value: string | null) {
  const match = value?.match(supplyRecordPattern);
  return match && Number.isSafeInteger(Number(match[2])) ? { type: match[1], id: match[2], record: value! } : null;
}
function exactRecordParam(params: URLSearchParams, key: string, id?: string) {
  const values = params.getAll(key);
  return values.length === 1 && /^[1-9]\d*$/.test(values[0]) && Number.isSafeInteger(Number(values[0]))
    && (id === undefined || values[0] === id);
}
function supplySelectionMatchesSource(params: URLSearchParams, selection: NonNullable<ReturnType<typeof supplyRecordIntent>>, path?: string) {
  const routes = {
    kitchen_order: { path: "/central-kitchen-orders", key: "orderId" },
    transfer: { path: "/transfer-requests", key: "transferId" },
    reverse_movement: { path: "/reverse-logistics", key: "movementId" },
  } as const;
  if (selection.type !== "delivery_assignment") {
    const route = routes[selection.type as keyof typeof routes];
    return (!path || path === route.path) && exactRecordParam(params, route.key, selection.id);
  }
  if (!exactRecordParam(params, "deliveryId", selection.id)) return false;
  const sourceKeys = ["orderId", "transferId", "movementId", "shipmentId"].filter(key => params.has(key));
  if (sourceKeys.length > 1 || sourceKeys.some(key => !exactRecordParam(params, key))) return false;
  if (!path || path === "/driver-deliveries") return true;
  const embeddedRoutes: Record<string, string> = {
    "/central-kitchen-orders": "orderId", "/transfer-requests": "transferId",
    "/finished-goods-inventory": "transferId", "/reverse-logistics": "movementId",
    "/kitchen-warehouse-shipping": "shipmentId",
  };
  // A legal embedded delivery CTA selects the persisted related source as
  // well as the assignment. It is not required to open the standalone desk.
  return !!embeddedRoutes[path] && exactRecordParam(params, embeddedRoutes[path]);
}

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
  const conflict = params.getAll("branch").length > 1 || params.getAll("branchId").length > 1
    || (branch !== null && branchId !== null && branch !== branchId);
  return { branch: conflict ? "" : branch ?? branchId ?? "", explicit, conflict };
}

function exactParam(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

const peopleRecordPattern = /^(leave|advance|attendance_record|joining_offer|joining_notification):([1-9]\d*)$/;
export function peopleRecordIntent(value: string | null) {
  const match = value?.match(peopleRecordPattern);
  return match && Number.isSafeInteger(Number(match[2])) ? { type: match[1], id: match[2], record: value! } : null;
}

export function peopleRecordFromSource(source: URL) {
  const routes: Record<string, { type: string; key: string }> = {
    "/hr/leaves": { type: "leave", key: "leaveId" },
    "/hr/advances": { type: "advance", key: "advanceId" },
    "/employee-attendance-report": { type: "attendance_record", key: "attendanceId" },
    "/hr-hub": source.searchParams.has("notificationId")
      ? { type: "joining_notification", key: "notificationId" } : { type: "joining_offer", key: "offerId" },
  };
  const route = routes[source.pathname];
  const selection = route ? peopleRecordIntent(`${route.type}:${exactParam(source.searchParams, route.key)}`) : null;
  return selection && peopleSelectionMatchesSource(source.searchParams, selection, source.pathname) ? selection : null;
}

function strictPeopleScope(params: URLSearchParams, key: string, allowedIds: readonly string[]) {
  if (params.getAll(key).length > 1) return null;
  const raw = params.get(key) || "";
  const ids = raw ? raw.split(",") : [];
  if (ids.some(id => !/^[\w-]{1,80}$/.test(id) || id.toLowerCase() === "all" || !allowedIds.includes(id))
    || new Set(ids).size !== ids.length) return null;
  return ids;
}

/** All source keys are exact, including a joining offer + notification pair.
 * Their persisted relationship is checked again by the authorized receiver. */
export function peopleSelectionMatchesSource(params: URLSearchParams, selection: NonNullable<ReturnType<typeof peopleRecordIntent>>, path: string) {
  const routes: Record<string, { path: string; key: string }> = {
    leave: { path: "/hr/leaves", key: "leaveId" },
    advance: { path: "/hr/advances", key: "advanceId" },
    attendance_record: { path: "/employee-attendance-report", key: "attendanceId" },
    joining_offer: { path: "/hr-hub", key: "offerId" },
    joining_notification: { path: "/hr-hub", key: "notificationId" },
  };
  const route = routes[selection.type];
  if (path !== route.path || !exactRecordParam(params, route.key, selection.id)) return false;
  const joining = selection.type.startsWith("joining_");
  const keys = ["leaveId", "advanceId", "attendanceId", "offerId", "notificationId"];
  if (keys.some(key => params.has(key) && (joining ? !["offerId", "notificationId"].includes(key) : key !== route.key))) return false;
  if (joining && (exactParam(params, "tab") !== "employees" || exactParam(params, "section") !== "joining"
    || ["offerId", "notificationId"].some(key => params.has(key) && !exactRecordParam(params, key)))) return false;
  return true;
}

function peopleToolMatchesSource(source: URL) {
  const params = source.searchParams;
  if (["leaveId", "advanceId", "attendanceId", "offerId", "notificationId"].some(key => params.has(key))) return false;
  if (["/hr/leaves", "/hr/advances", "/employee-attendance-report"].includes(source.pathname))
    return !params.has("tab") && !params.has("section");
  if (source.pathname !== "/hr-hub") return false;
  const tab = exactParam(params, "tab");
  return tab === "payroll" || (tab === "employees" && (!params.has("section")
    || ["directory", "joining", "transfers"].includes(exactParam(params, "section") || "")));
}

/** People never has monthly's independently authorized all-branch exception. */
export function peopleSourceIntent(source: URL, allowedIds: readonly string[]) {
  const params = source.searchParams;
  const branchId = exactParam(params, "branchId");
  const selectedBranch = exactParam(params, "centerPeopleBranchId");
  const scope = strictPeopleScope(params, "centerBranchIds", allowedIds);
  const selection = peopleRecordIntent(exactParam(params, "centerPeopleRecord"));
  if (exactParam(params, "from") !== "operations-center" || exactParam(params, "centerWorkspace") !== "people" || !branchId || branchId !== selectedBranch
    || !allowedIds.includes(branchId) || !scope || (scope.length > 0 && !scope.includes(branchId))
    || (params.has("branch") && exactParam(params, "branch") !== branchId)
    || (params.has("centerPeopleRecord")
      ? !selection || !peopleSelectionMatchesSource(params, selection, source.pathname)
      : !peopleToolMatchesSource(source))) return null;
  return { branchId, selection, scope };
}

export function withPeopleReturn(href: string, branchId: string, record: string | null, origin: string) {
  const url = new URL(href, origin);
  const selection = peopleRecordIntent(record);
  if (url.origin !== origin || !/^[\w-]{1,80}$/.test(branchId) || branchId.toLowerCase() === "all"
    || (record !== null ? !selection || !peopleSelectionMatchesSource(url.searchParams, selection, url.pathname) : !peopleToolMatchesSource(url)))
    throw new Error("Invalid people destination");
  url.searchParams.set("centerWorkspace", "people");
  url.searchParams.set("centerPeopleBranchId", branchId);
  if (record) url.searchParams.set("centerPeopleRecord", record);
  else url.searchParams.delete("centerPeopleRecord");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function peopleReturnIntent(search: string, allowedIds: readonly string[]) {
  const params = new URLSearchParams(search);
  const scope = strictPeopleScope(params, "branchIds", allowedIds);
  const branchId = exactParam(params, "peopleBranchId") || "";
  const selection = peopleRecordIntent(exactParam(params, "peopleRecord"));
  const valid = params.getAll("workspace").length <= 1 && !!scope && (!params.has("peopleBranchId") || (!!branchId && allowedIds.includes(branchId)
    && (!scope.length || scope.includes(branchId)))) && (!params.has("peopleRecord") || (!!branchId && !!selection));
  return { people: exactParam(params, "workspace") === "people", branchId: valid ? branchId : "",
    record: valid ? selection?.record ?? null : null, valid };
}

/** Each await is a freshness boundary. A→B→A is rejected by the caller's
 * monotonically increasing command generation, not by value equality. */
export async function validatePeopleSourceNavigation(source: URL, checks: {
  branches: () => Promise<readonly string[] | null>;
  permission: () => Promise<boolean>;
  record: () => Promise<boolean>;
  isCurrent: () => boolean;
}) {
  if (!checks.isCurrent()) return null;
  const ids = await checks.branches();
  if (!checks.isCurrent() || !ids || !peopleSourceIntent(source, ids)) return null;
  if (!(await checks.permission()) || !checks.isCurrent()) return null;
  if (!(await checks.record()) || !checks.isCurrent()) return null;
  return ids;
}

function authorizedMonthBranch(branchId: string | null, allowedIds: readonly string[]) {
  return !!branchId && (branchId === "all" ? allowedIds.length > 0 : allowedIds.includes(branchId));
}

export function monthlyReturnIntent(search: string, allowedIds: readonly string[]) {
  const params = new URLSearchParams(search);
  const requested = exactParam(params, "monthBranchId");
  const month = exactParam(params, "month") || "";
  const file = exactParam(params, "monthFile");
  return {
    monthly: exactParam(params, "workspace") === "monthly",
    branchId: authorizedMonthBranch(requested, allowedIds) ? requested! : "",
    month: monthPattern.test(month) ? month : "",
    file: monthFiles.includes(file as MonthFile) ? file as MonthFile : null,
  };
}

export function withMonthlyReturn(href: string, branchId: string, month: string, file: MonthFile | null, origin: string) {
  const url = new URL(href, origin);
  if (url.origin !== origin || !monthPattern.test(month) || !branchId || /[,\s]/.test(branchId)
    || (file !== null && !monthFiles.includes(file))) throw new Error("Invalid monthly destination");
  url.searchParams.set("centerWorkspace", "monthly");
  url.searchParams.set("centerMonth", month);
  url.searchParams.set("centerMonthBranchId", branchId);
  if (file) url.searchParams.set("centerMonthFile", file);
  else url.searchParams.delete("centerMonthFile");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** A source branch is a candidate only; it must match freshly fetched grants.
 * Aggregate month intent is read-only and never becomes an aggregate source. */
export function monthlySourceIntent(source: URL, allowedIds: readonly string[]) {
  const params = source.searchParams;
  const branchId = exactParam(params, "branchId");
  const monthBranchId = exactParam(params, "centerMonthBranchId");
  const month = exactParam(params, "centerMonth");
  const file = exactParam(params, "centerMonthFile");
  const legalSource = ["/hr-hub", "/salary-closing", "/pnl-dashboard", "/branch-daily-closures", "/branch-daily-closing", "/sales-analytics"].includes(source.pathname)
    || /^\/branch-daily-closures\/[1-9]\d*$/.test(source.pathname);
  if (!legalSource || exactParam(params, "centerWorkspace") !== "monthly" || !month || !monthPattern.test(month)
    || !authorizedMonthBranch(monthBranchId, allowedIds)
    || !branchId || branchId === "all" || !allowedIds.includes(branchId)
    || (monthBranchId !== "all" && monthBranchId !== branchId)
    || (params.has("centerMonthFile") && !monthFiles.includes(file as MonthFile))
    || (params.has("month") && exactParam(params, "month") !== month)) return null;
  if (source.pathname === "/salary-closing") {
    const salary = salaryBranchIntent(source.search);
    if (salary.conflict || salary.branch !== branchId) return null;
  } else if (params.has("branch") && exactParam(params, "branch") !== branchId) return null;
  return { branchId, monthBranchId: monthBranchId!, month, file: file as MonthFile | null };
}

/** HR's automatic source selection sync must not turn an all-month Return into
 * a single-branch month, or change the aggregate month/file selected in center. */
export function preserveMonthlyAllReturn(href: string, search: string) {
  const original = new URLSearchParams(search);
  if (exactParam(original, "centerWorkspace") !== "monthly"
    || exactParam(original, "centerMonthBranchId") !== "all"
    || !monthPattern.test(exactParam(original, "centerMonth") || "")) return href;
  const next = new URL(href, "https://navigation.invalid");
  next.searchParams.set("centerMonthBranchId", "all");
  next.searchParams.set("centerMonth", original.get("centerMonth")!);
  return `${next.pathname}${next.search}${next.hash}`;
}

export function attachCenterContext(url: URL, branchId: string, scope: readonly string[], performanceDays?: 7 | 30) {
  const explicitBranches = url.searchParams.getAll("branchId");
  if (explicitBranches.length > 1 || (explicitBranches.length === 1 && explicitBranches[0] !== branchId)) throw new Error("Conflicting source branch");
  if (url.pathname === "/kitchen-warehouse-shipping") {
    const kitchens = url.searchParams.getAll("kitchenId");
    if (kitchens.length > 1 || (kitchens.length === 1 && kitchens[0] !== branchId)) throw new Error("Conflicting source kitchen");
  }
  if (url.searchParams.has("centerSupplyRecord") || url.searchParams.has("centerSupplyBranchId")) {
    const selection = supplyRecordIntent(url.searchParams.get("centerSupplyRecord"));
    if (url.searchParams.getAll("centerWorkspace").length !== 1 || url.searchParams.get("centerWorkspace") !== "production"
      || url.searchParams.getAll("centerSupplyRecord").length !== 1 || !selection
      || url.searchParams.getAll("centerSupplyBranchId").length !== 1 || url.searchParams.get("centerSupplyBranchId") !== branchId
      || (scope.length > 0 && !scope.includes(branchId))
      || !supplySelectionMatchesSource(url.searchParams, selection, url.pathname)) throw new Error("Invalid supply return selection");
  }
  if (url.pathname === "/salary-closing") {
    const intent = salaryBranchIntent(url.search);
    if (intent.conflict || (intent.explicit && intent.branch !== branchId)) throw new Error("Conflicting salary branch");
    url.searchParams.set("branch", branchId);
  }
  const peopleRequested = url.searchParams.getAll("centerWorkspace").includes("people")
    || url.searchParams.has("centerPeopleRecord") || url.searchParams.has("centerPeopleBranchId");
  if (peopleRequested && (url.searchParams.getAll("centerWorkspace").length !== 1
    || url.searchParams.getAll("centerBranchIds").length > 1
    || (url.searchParams.has("centerBranchIds") && url.searchParams.get("centerBranchIds") !== scope.join(","))
    || url.searchParams.getAll("from").length > 1
    || (url.searchParams.has("from") && url.searchParams.get("from") !== "operations-center")))
    throw new Error("Invalid people return scope");
  url.searchParams.set("branchId", branchId);
  url.searchParams.set("from", "operations-center");
  url.searchParams.set("centerBranchIds", scope.join(","));
  if (performanceDays === 7 || performanceDays === 30) url.searchParams.set("centerPerformanceDays", String(performanceDays));
  if (peopleRequested) {
    if (!peopleSourceIntent(url, scope.length ? scope : [branchId])) throw new Error("Invalid people return selection");
  }
}

/** Preserve source intent; never pick an arbitrary selected branch for a notice.
 * Source permissions remain server gates, not something a query string grants. */
export function centerNoticeDestination(
  action: string | null | undefined, noticeBranches: readonly string[], allowedScope: readonly string[],
  returnScope: readonly string[], performanceDays: 7 | 30, origin: string,
  workspace?: string,
): { href: string; branchId: string } | null {
  const href = parseNoticeAction(action, origin);
  if (!href) return null;
  const url = new URL(href, origin);
  const explicit = url.searchParams.getAll("branchId");
  if (explicit.length > 1) return null;
  // Shipping uses kitchenId rather than branchId in its canonical API.
  const kitchens = url.searchParams.getAll("kitchenId");
  if (kitchens.length > 1 || (explicit.length && kitchens.length && explicit[0] !== kitchens[0])) return null;
  const branchId = explicit[0] ?? kitchens[0] ?? (noticeBranches.length === 1 ? noticeBranches[0] : "");
  if (!branchId || (noticeBranches.length > 0 && !noticeBranches.includes(branchId)) || !allowedScope.includes(branchId)
    || returnScope.some(id => !allowedScope.includes(id))) return null;
  try {
    if (workspace === "production") {
      url.searchParams.set("centerWorkspace", "production");
      if (!url.searchParams.has("centerSupplyRecord") && !url.searchParams.has("centerSupplyBranchId")) {
        const sources: Record<string, { type: string; key: string }> = {
          "/central-kitchen-orders": { type: "kitchen_order", key: "orderId" },
          "/transfer-requests": { type: "transfer", key: "transferId" },
          "/reverse-logistics": { type: "reverse_movement", key: "movementId" },
        };
        const source = url.searchParams.has("deliveryId")
          ? { type: "delivery_assignment", key: "deliveryId" } : sources[url.pathname];
        const selection = source ? supplyRecordIntent(`${source.type}:${url.searchParams.get(source.key)}`) : null;
        if (selection && supplySelectionMatchesSource(url.searchParams, selection, url.pathname)) {
          url.searchParams.set("centerSupplyRecord", selection.record);
          url.searchParams.set("centerSupplyBranchId", branchId);
        }
      }
    }
    attachCenterContext(url, branchId, returnScope, performanceDays);
    return { href: `${url.pathname}${url.search}${url.hash}`, branchId };
  } catch { return null; }
}

export function operationsCenterReturnHref(search: string, allowedIds: readonly string[], sourcePath?: string) {
  const input = new URLSearchParams(search);
  const params = new URLSearchParams();
  const rawScope = input.get("centerBranchIds") || "";
  const rawIds = rawScope.split(",");
  const validReturnScope = input.getAll("centerBranchIds").length <= 1
    && (!rawScope || (rawIds.every(id => !!id && id !== "all" && !/\s/.test(id))
      && new Set(rawIds).size === rawIds.length));
  const ids = rawIds.filter(id => allowedIds.includes(id));
  if (ids.length) params.set("branchIds", Array.from(new Set(ids)).join(","));
  // Do not silently broaden an explicitly selected outer scope to all after its
  // last branch is revoked (or the URL is malformed). Center will deny it.
  else if (input.get("centerBranchIds")) params.set("branchIds", input.get("centerBranchIds")!);
  if (!validReturnScope) params.set("branchIds", "__invalid_scope__");
  const performanceDays = performanceDaysIntent(search, "centerPerformanceDays");
  if (performanceDays !== null) params.set("performanceDays", String(performanceDays));
  const month = exactParam(input, "centerMonth") || "";
  const branchId = exactParam(input, "centerMonthBranchId") || "";
  const monthFile = exactParam(input, "centerMonthFile");
  const sourceBranch = exactParam(input, "branchId");
  const salaryAlias = exactParam(input, "branch");
  const sourceBranchValid = !input.has("branchId") || (!!sourceBranch && sourceBranch !== "all"
    && allowedIds.includes(sourceBranch) && (branchId === "all" || branchId === sourceBranch));
  const sourceAliasValid = !input.has("branch") || (!!salaryAlias && salaryAlias === sourceBranch);
  if (exactParam(input, "centerWorkspace") === "monthly" && monthPattern.test(month)
    && authorizedMonthBranch(branchId, allowedIds) && sourceBranchValid && sourceAliasValid && validReturnScope
    && (!input.has("centerMonthFile") || monthFiles.includes(monthFile as MonthFile))) {
    params.set("workspace", "monthly");
    params.set("month", month);
    params.set("monthBranchId", branchId);
    if (monthFile) params.set("monthFile", monthFile);
  } else if (input.getAll("centerWorkspace").includes("people") || input.has("centerPeopleBranchId") || input.has("centerPeopleRecord")) {
    params.set("workspace", "people");
    const path = sourcePath ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const people = peopleSourceIntent(new URL(`${path || "/"}?${input}`, "https://navigation.invalid"), allowedIds);
    if (people && validReturnScope) {
      params.set("peopleBranchId", people.branchId);
      if (people.selection) params.set("peopleRecord", people.selection.record);
    } else params.set("peopleBranchId", "__invalid_scope__");
  } else if (input.get("centerWorkspace") === "analysis") {
    params.set("workspace", "analysis");
  } else if (input.get("centerWorkspace") === "production") {
    params.set("workspace", "production");
    const selection = supplyRecordIntent(input.get("centerSupplyRecord"));
    const selectedBranch = input.get("centerSupplyBranchId") || "";
    const explicitReturnScope = !!input.get("centerBranchIds");
    const rawScope = (input.get("centerBranchIds") || "").split(",");
    const wellFormedScope = !explicitReturnScope || (rawScope.every(id => !!id && id !== "all")
      && new Set(rawScope).size === rawScope.length);
    if (input.getAll("centerWorkspace").length === 1 && input.getAll("centerSupplyRecord").length === 1 && selection
      && input.getAll("centerSupplyBranchId").length === 1 && allowedIds.includes(selectedBranch)
      && input.getAll("centerBranchIds").length <= 1 && wellFormedScope
      && (!explicitReturnScope || ids.includes(selectedBranch))
      && input.getAll("branchId").length === 1 && input.get("branchId") === selectedBranch
      && supplySelectionMatchesSource(input, selection)) {
      params.set("supplyRecord", selection.record);
      params.set("supplyBranchId", selectedBranch);
    }
  }
  return `/operations-center${params.size ? `?${params}` : ""}`;
}

/** Persist only validated production/monthly selection in the current center
 * entry before pushing the source. Browser Back and the source Return action
 * must restore the same record; arbitrary source query fields are not copied. */
export function navigateCenterSourceWithHistory(
  source: URL, allowedIds: readonly string[],
  navigate: (href: string, options?: { replace?: boolean }) => void,
) {
  const selection = supplyRecordIntent(source.searchParams.get("centerSupplyRecord"));
  const returnHref = operationsCenterReturnHref(source.search, allowedIds, source.pathname);
  const restored = new URL(returnHref, source.origin).searchParams;
  const monthly = monthlySourceIntent(source, allowedIds);
  const monthlyRequested = source.searchParams.getAll("centerWorkspace").includes("monthly")
    || ["centerMonth", "centerMonthBranchId", "centerMonthFile"].some(key => source.searchParams.has(key));
  if (monthlyRequested && (!monthly || restored.get("workspace") !== "monthly")) return;
  const peopleRequested = source.searchParams.getAll("centerWorkspace").includes("people")
    || ["centerPeopleBranchId", "centerPeopleRecord"].some(key => source.searchParams.has(key));
  const people = peopleSourceIntent(source, allowedIds);
  if (peopleRequested && (!people || restored.get("workspace") !== "people"
    || restored.get("peopleBranchId") !== people.branchId)) return;
  if (people) {
    navigate(returnHref, { replace: true });
  } else if (monthly && restored.get("workspace") === "monthly"
    && restored.get("month") === monthly.month && restored.get("monthBranchId") === monthly.monthBranchId) {
    navigate(returnHref, { replace: true });
  } else if (selection && supplySelectionMatchesSource(source.searchParams, selection, source.pathname)
    && restored.get("workspace") === "production"
    && restored.get("supplyRecord") === selection.record && restored.has("supplyBranchId")) {
    navigate(returnHref, { replace: true });
  }
  navigate(`${source.pathname}${source.search}${source.hash}`);
}