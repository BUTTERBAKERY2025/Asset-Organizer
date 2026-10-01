import type { OperationsQueueItem } from "./operations-center";

export const operationsSalesSources = ["journals", "closures"] as const;
export type OperationsSalesSource = (typeof operationsSalesSources)[number];
export type SalesCoverage = "complete" | "forbidden" | "unavailable";
export type OperationsSalesRecord = OperationsQueueItem & {
  domain: OperationsSalesSource;
  /** Persisted source business date, not a guessed deadline. */
  businessDate: string;
  creator: { id: string | null; name: string | null };
  cashier?: { id: string; name: string };
  facts: {
    totalSales: number | null;
    cashDiscrepancy: number | null;
    bankDiscrepancy: number | null;
    journalsCount: number | null;
  };
  nextStep: { label: string; href: string };
};
export type OperationsSalesResponse = {
  generatedAt: string; businessDate: string;
  scope: { branchIds: string[]; requested: string[]; source: OperationsSalesSource | "all"; offset: number; limit: number };
  branches: { id: string; name: string }[];
  records: OperationsSalesRecord[];
  summaries: { source: OperationsSalesSource; label: string; definition: string; value: number | null; coverage: SalesCoverage }[];
  coverage: {
    sources: Record<OperationsSalesSource, { state: SalesCoverage; reason: string | null }>;
    /** Source-record counts only; never total sales or completed business days. */
    total: number | null;
    nextOffset: number | null;
  };
};

export function parseOperationsSalesQuery(query: Record<string, unknown>) {
  if (typeof query.branchIds !== "string") throw new Error("Select branchIds explicitly");
  const branchIds = query.branchIds.split(",").map(id => id.trim());
  if (!branchIds.length || branchIds.length > 30 || branchIds.some(id => !id || id.toLowerCase() === "all")
    || new Set(branchIds).size !== branchIds.length) throw new Error("Invalid branchIds");
  const source = query.source ?? "all";
  if (source !== "all" && !operationsSalesSources.includes(source as OperationsSalesSource)) throw new Error("Invalid source");
  const integer = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid pagination");
    return Number(value);
  };
  const offset = integer(query.offset, 0), limit = integer(query.limit, 30);
  if (limit < 1 || limit > 100) throw new Error("Invalid limit");
  return { branchIds, source: source as OperationsSalesSource | "all", offset, limit };
}

export function salesPagePlan(counts: { source: OperationsSalesSource; count: number }[], offset: number, limit: number) {
  let skip = offset, remaining = limit;
  const plan: { source: OperationsSalesSource; offset: number; limit: number }[] = [];
  for (const { source, count } of counts) {
    if (skip >= count) { skip -= count; continue; }
    const take = Math.min(count - skip, remaining);
    if (take > 0) plan.push({ source, offset: skip, limit: take });
    remaining -= take; skip = 0;
    if (!remaining) break;
  }
  return plan;
}