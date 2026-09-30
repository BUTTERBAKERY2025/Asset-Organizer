import type { BranchOperationsCard } from "./branch-operations";

export type OperationsMetric = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  source: string;
  definition: string;
  period: string;
  scope: string[];
  asOf: string;
  coverage: "complete" | "partial" | "unavailable";
};

export type OperationsCard = Omit<BranchOperationsCard, "metrics"> & {
  branchId: string;
  module: string;
  metrics: OperationsMetric[];
  error?: string;
};

export type OperationsQueueItem = {
  id: string;
  sourceType: string;
  sourceId: string;
  step: string;
  branchId: string;
  module: string;
  title: string;
  status: string;
  owner: string;
  /** Persisted assigned actor only; stage labels are never personal assignments. */
  ownerId: string | null;
  dueAt: string | null;
  href: string;
  actions: { label: string; href: string; capability: "read" }[];
};

export type OperationsEvidenceDay = {
  date: string;
  branchId: string;
  opening: "recorded" | "unavailable";
  closing: "closed" | "incomplete" | "not_recorded" | "unavailable";
  journalCount: number | null;
  source: string[];
};

export type OperationsCenterResponse = {
  generatedAt: string;
  businessDate: string;
  scope: { branchIds: string[]; requested: string[] | "all"; limit: number };
  branches: { id: string; name: string }[];
  modules: string[];
  cards: OperationsCard[];
  metrics: OperationsMetric[];
  queue: OperationsQueueItem[];
  daily: OperationsEvidenceDay[];
  weekly: { startDate: string; endDate: string; recordedClosings: number; recordedJournals: number | null; coverage: "complete" | "partial" }[];
  coverage: { queue: Record<string, "complete" | "unavailable">; truncated: boolean; nextOffset: number | null };
};

export type OperationsMonthSection = {
  id: "payroll" | "expenses" | "closing" | "sales";
  label: string;
  source: string;
  coverage: "complete" | "partial" | "unavailable";
  summary: string;
  value: number | null;
  href: string | null;
  /** A multi-branch value is read-only; each destination is a single authorized branch. */
  branches?: { branchId: string; summary: string; value: number | null; href: string | null }[];
};

export type OperationsMonthResponse = {
  month: string;
  branchIds: string[];
  sections: OperationsMonthSection[];
};

/** These are display cohorts, not approvals or inferred outstanding work. */
export function operationsDecisionQueue(rows: OperationsQueueItem[], actorId: string | undefined, asOf: string) {
  const seen = new Set<string>();
  const unique = rows.filter(item => {
    const key = `${item.branchId}:${item.sourceType}:${item.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const urgent = unique.filter(item => item.dueAt && Number.isFinite(Date.parse(item.dueAt)) && Date.parse(item.dueAt) < Date.parse(asOf));
  const assigned = unique.filter(item => actorId && item.ownerId === actorId && !urgent.includes(item));
  const followup = unique.filter(item => !urgent.includes(item) && !assigned.includes(item));
  return { unique, urgent, assigned, followup };
}

/** A zero-sized observed cohort has no meaningful pass rate. */
export function qualityPassRate(results: readonly string[]): number | null {
  return results.length ? results.filter(result => result === "passed").length / results.length * 100 : null;
}

/** Never collapse different source records simply because their destination is the same page. */
export function deduplicateOperationsQueue(rows: OperationsQueueItem[]): OperationsQueueItem[] {
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

export function validateOperationsBranches(requested: string[] | "all", allowed: string[] | null, existing: string[]): boolean {
  return requested === "all" || requested.length === existing.length
    && requested.every(id => existing.includes(id) && (allowed === null || allowed.includes(id)));
}

/** A failed card must remain absent from aggregates, not silently become a zero. */
export function availableCardMetrics(cards: OperationsCard[]): OperationsMetric[] {
  return cards.flatMap(card => card.state === "ready" ? card.metrics : []);
}

/** Preserve list filters but always target the canonical persisted source record. */
export function sourceRecordHref(sourceType: string, sourceId: number | string, href: string): string {
  const id = String(sourceId);
  if (!/^[1-9]\d*$/.test(id)) throw new Error("Invalid source record ID");
  if (sourceType === "cashier_journal") {
    const [path, search = ""] = href.split("?");
    const params = new URLSearchParams(search);
    params.delete("status");
    return `${path}/${id}?${params.toString()}`;
  }
  const parameter: Record<string, string> = {
    maintenance: "ticketId", kitchen_order: "orderId", transfer: "transferId",
    reverse_movement: "movementId", delivery_assignment: "deliveryId",
    leave: "leaveId", attendance_record: "attendanceId", advance: "advanceId",
    quality_check: "checkId", daily_closure: "closureId",
  };
  const key = parameter[sourceType];
  if (!key) throw new Error(`Unsupported source type: ${sourceType}`);
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set(key, id);
  return `${path}?${params.toString()}`;
}

export function makeOperationsQueueItem(sourceType: string, sourceId: number | string, step: string, branchId: string,
  module: string, title: string, status: string, listHref: string, owner = "غير محدد",
  dueAt: string | null = null, ownerId: string | null = null): OperationsQueueItem {
  const href = sourceRecordHref(sourceType, sourceId, listHref);
  return {
    id: `${sourceType}:${sourceId}:${step}:${branchId}`, sourceType, sourceId: String(sourceId), step, branchId,
    module, title, status, owner, ownerId, dueAt, href,
    actions: [{ label: "عرض المصدر", href, capability: "read" }],
  };
}