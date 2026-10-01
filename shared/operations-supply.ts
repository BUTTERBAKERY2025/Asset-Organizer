import type { OperationsQueueItem } from "./operations-center";

export const operationsSupplySources = ["kitchen", "transfers", "reverse", "delivery"] as const;
export type OperationsSupplySource = (typeof operationsSupplySources)[number];
export type SupplyCoverage = "complete" | "forbidden" | "unavailable";
export type OperationsSupplyRecord = OperationsQueueItem & {
  domain: OperationsSupplySource;
  /** Selected, authorized endpoints only. A source is returned once, not once per endpoint. */
  branchIds: string[];
  stage: string;
  responsibleRole: string | null;
  nextStep: { label: string; href: string | null };
  inventoryMode: "real" | "shadow" | "unknown";
  deadlineLabel: string | null;
  priority: string | null;
  /** No mapped source priority; null is not proof that there are zero urgent cases. */
  priorityCoverage?: "complete" | "unavailable";
  /** Persisted underlying movement of a delivery assignment, not another movement count. */
  relatedSource?: { sourceType: string; sourceId: string };
  capabilityCoverage?: "complete" | "unavailable";
};
export type OperationsSupplySummary = {
  source: OperationsSupplySource;
  label: string;
  value: number | null;
  definition: string;
  coverage: SupplyCoverage;
};
export type OperationsSupplyResponse = {
  generatedAt: string;
  businessDate: string;
  scope: { branchIds: string[]; requested: string[]; source: OperationsSupplySource | "all"; offset: number; limit: number };
  branches: { id: string; name: string }[];
  records: OperationsSupplyRecord[];
  summaries: OperationsSupplySummary[];
  coverage: {
    sources: Record<OperationsSupplySource, { state: SupplyCoverage; reason: string | null }>;
    /** Urgency is not projected from source priorities, independent of pagination coverage. */
    priorityCoverage?: "complete" | "unavailable";
    /** Pagination cardinality only. Never a KPI summing mixed movement and assignment sources. */
    total: number | null;
    nextOffset: number | null;
  };
};

/** No implied all-branch scope, duplicate IDs, coercion of arrays, or bounded oldest-record horizon. */
export function parseOperationsSupplyQuery(query: Record<string, unknown>) {
  if (typeof query.branchIds !== "string") throw new Error("Select branchIds explicitly");
  const branchIds = query.branchIds.split(",").map(id => id.trim());
  if (!branchIds.length || branchIds.length > 30 || branchIds.some(id => !id || id.toLowerCase() === "all")
    || new Set(branchIds).size !== branchIds.length) throw new Error("Invalid branchIds");
  const source = query.source ?? "all";
  if (source !== "all" && !operationsSupplySources.includes(source as OperationsSupplySource)) throw new Error("Invalid source");
  const integer = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid pagination");
    return Number(value);
  };
  const offset = integer(query.offset, 0), limit = integer(query.limit, 50);
  if (limit < 1 || limit > 100) throw new Error("Invalid limit");
  return { branchIds, source: source as OperationsSupplySource | "all", offset, limit };
}

/** Domain order then descending persisted ID. Full SQL counts determine each source's real offset. */
export function supplyPagePlan(counts: { source: OperationsSupplySource; count: number }[], offset: number, limit: number) {
  let skip = offset, remaining = limit;
  const plan: { source: OperationsSupplySource; offset: number; limit: number }[] = [];
  for (const entry of counts) {
    if (skip >= entry.count) { skip -= entry.count; continue; }
    const take = Math.min(entry.count - skip, remaining);
    if (take > 0) plan.push({ source: entry.source, offset: skip, limit: take });
    remaining -= take;
    skip = 0;
    if (!remaining) break;
  }
  return plan;
}

/** Canonical source identity, independent of stages and endpoint copies. */
export function uniqueSupplyRecords(records: OperationsSupplyRecord[]) {
  const unique = new Map<string, OperationsSupplyRecord>();
  for (const record of records) {
    const key = `${record.sourceType}:${record.sourceId}`;
    const previous = unique.get(key);
    unique.set(key, previous ? { ...previous, branchIds: Array.from(new Set([...previous.branchIds, ...record.branchIds])) } : record);
  }
  return Array.from(unique.values());
}