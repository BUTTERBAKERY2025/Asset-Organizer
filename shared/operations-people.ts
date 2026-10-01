import type { OperationsQueueItem } from "./operations-center";

export const operationsPeopleSources = ["leaves", "leave_movements", "advances", "attendance", "joining"] as const;
export type OperationsPeopleSource = (typeof operationsPeopleSources)[number];
export type PeopleCoverage = "complete" | "forbidden" | "unavailable";
export type OperationsPeopleRecord = OperationsQueueItem & {
  domain: OperationsPeopleSource;
  employee?: { id?: number; name: string; number?: string | null; jobTitle?: string | null };
  offerId?: number;
  notificationId?: number;
  attendance?: { date: string | null; checkIn: string | null; checkOut: string | null };
};
export type OperationsPeopleSummary = {
  source: OperationsPeopleSource; label: string; definition: string;
  value: number | null; coverage: PeopleCoverage;
};
export type OperationsPeopleTool = {
  id: "directory" | "joining" | "transfers" | "payroll";
  label: string; module: string; href: string; branchId: string;
  kind: "directory" | "workflow" | "history" | "advisory";
};
export type OperationsPeopleResponse = {
  generatedAt: string; businessDate: string;
  scope: { branchIds: string[]; requested: string[]; source: OperationsPeopleSource | "all"; offset: number; limit: number };
  branches: { id: string; name: string }[];
  records: OperationsPeopleRecord[];
  summaries: OperationsPeopleSummary[];
  employees: { value: number | null; active: number | null; coverage: PeopleCoverage; definition: string };
  tools: OperationsPeopleTool[];
  coverage: {
    sources: Record<OperationsPeopleSource, { state: PeopleCoverage; reason: string | null }>;
    /** Pagination cardinality, not a KPI combining unlike employee workflows. */
    total: number | null; nextOffset: number | null;
  };
};

export function parseOperationsPeopleQuery(query: Record<string, unknown>) {
  if (typeof query.branchIds !== "string") throw new Error("Select branchIds explicitly");
  const branchIds = query.branchIds.split(",").map(id => id.trim());
  if (!branchIds.length || branchIds.length > 30 || branchIds.some(id => !id || id.toLowerCase() === "all")
      || new Set(branchIds).size !== branchIds.length) throw new Error("Invalid branchIds");
  const source = query.source ?? "all";
  if (source !== "all" && !operationsPeopleSources.includes(source as OperationsPeopleSource)) throw new Error("Invalid source");
  const integer = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid pagination");
    return Number(value);
  };
  const offset = integer(query.offset, 0), limit = integer(query.limit, 50);
  if (limit < 1 || limit > 100) throw new Error("Invalid limit");
  return { branchIds, source: source as OperationsPeopleSource | "all", offset, limit };
}

/** Full source counts, never a fixed newest-record scan, determine each SQL page. */
export function peoplePagePlan(counts: { source: OperationsPeopleSource; count: number }[], offset: number, limit: number) {
  let skip = offset, remaining = limit;
  const plan: { source: OperationsPeopleSource; offset: number; limit: number }[] = [];
  for (const { source, count } of counts) {
    if (skip >= count) { skip -= count; continue; }
    const take = Math.min(count - skip, remaining);
    if (take > 0) plan.push({ source, offset: skip, limit: take });
    remaining -= take;
    skip = 0;
    if (!remaining) break;
  }
  return plan;
}

/** Joining's persisted identity is a notification, not a guessed offer ID. */
export function peopleJoiningHref(branchId: string, notificationId: number) {
  if (!Number.isSafeInteger(notificationId) || notificationId < 1) throw new Error("Invalid notification ID");
  return `/hr-hub?${new URLSearchParams({
    tab: "employees", section: "joining", branchId, notificationId: String(notificationId),
  })}`;
}