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
  /** Source-declared urgency only; never inferred from a deadline or stage. */
  priorityReason?: "urgent" | "critical";
  /** Stable persisted identity; accessing another category never creates a task. */
  canonicalId?: string;
  reason?: string;
  history?: { at: string; label: string; actorId?: string | null }[];
  /** Set only after checking current stage AND this actor's action authority. */
  decision?: {
    awaitingActor: boolean;
    actorId: string;
    reason: string;
    label: string;
    href: string;
    capability: "approve" | "review";
    permission: { module: string; action: string };
  };
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
  analytics?: OperationsDeskAnalytics;
};

export type OperationsDeskAnalytics = {
  generatedAt: string;
  period: { from: string; to: string };
  /** Deterministic source observations, explicitly not AI output. */
  observations?: { kind: "evidence"; title: string; explanation: string; source: string; branchId?: string; href: string | null }[];
  sales: {
    source: string;
    coverage: "partial" | "unavailable";
    /** Null means no confirmed evidence, never a fabricated zero. */
    daily: { date: string; value: number | null; recordedBranches: number }[];
    total: number | null;
    byBranch?: { branchId: string; daily: { date: string; value: number | null; recordedBranches: number }[]; total: number | null }[];
    hrefs: { branchId: string; href: string }[];
  };
  followups: {
    source: string;
    coverage: "complete" | "partial" | "unavailable";
    byBranch: { branchId: string; count: number; awaitingDecision: number; emergency: number }[];
  };
};

export type OperationsMonthSection = {
  id: "payroll" | "expenses" | "closing" | "sales";
  label: string;
  source: string;
  coverage: "complete" | "partial" | "unavailable";
  summary: string;
  value: number | null;
  href: string | null;
  status?: "recorded" | "needs_review" | "unknown" | "unavailable";
  verifiedGaps?: string[];
  responsibleRole?: string | null;
  nextStep?: { label: string; href: string | null };
  /** A multi-branch value is read-only; each destination is a single authorized branch. */
  branches?: { branchId: string; summary: string; value: number | null; href: string | null;
    status?: "recorded" | "needs_review" | "unknown" | "unavailable"; verifiedGaps?: string[];
    responsibleRole?: string | null; nextStep?: { label: string; href: string | null } }[];
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
  const critical = unique.filter(item => item.priorityReason === "urgent" || item.priorityReason === "critical");
  const awaitingDecision = unique.filter(item => item.decision?.awaitingActor === true && item.decision.actorId === actorId);
  const urgent = unique.filter(item => !critical.includes(item) && item.dueAt && Number.isFinite(Date.parse(item.dueAt)) && Date.parse(item.dueAt) < Date.parse(asOf));
  const assigned = unique.filter(item => actorId && item.ownerId === actorId && !critical.includes(item) && !urgent.includes(item));
  const followup = unique.filter(item => !critical.includes(item) && !urgent.includes(item) && !assigned.includes(item));
  // Keep urgent as the legacy deadline cohort for existing consumers.
  return { unique, critical, urgent, assigned, followup, awaitingDecision };
}

/** Actor assignment alone never establishes an approval step. */
export function operationsDecisionMetadata(item: OperationsQueueItem, actorId: string, canAct: boolean,
  eligibleStage: boolean, permission: { module: string; action: string }, label: string): OperationsQueueItem["decision"] {
  if (!canAct || !eligibleStage) return undefined;
  return { awaitingActor: true, actorId, reason: `السجل في مرحلة ${item.step} وتملك صلاحية هذه الخطوة`,
    label, href: item.href, capability: "approve", permission };
}

/** Exact role predicate from the persisted advance workflow, not an arbitrary edit grant. */
export function operationsAdvanceFinalAuthority(role: string, specialistEditConfigured: boolean): boolean {
  return ["admin", "super_admin", "hr_manager"].includes(role)
    || role === "hr_specialist" && specialistEditConfigured;
}

/** Ordinary next step, not every exceptional rejection/amendment the endpoint permits. */
export function operationsAdvanceDecisionMetadata(item: OperationsQueueItem, actorId: string,
  finalAuthority: boolean, canApprove: boolean, canEdit: boolean): OperationsQueueItem["decision"] {
  // awaiting_signature belongs to the employee. HR can amend/re-send, but that
  // administrative ability alone does not mean the record awaits HR's decision.
  const eligible = finalAuthority ? ["pending", "pre_approved", "signed"].includes(item.status) : item.status === "pending";
  const decision = operationsDecisionMetadata(item, actorId, canApprove || canEdit, eligible,
    { module: "hr_advances", action: canApprove ? "approve" : "edit" },
    !finalAuthority ? "مراجعة الموافقة الأولية للسلفة" : item.status === "signed" ? "مراجعة الاعتماد النهائي بعد التوقيع" : "مراجعة السلفة وإرسالها لتوقيع الموظف");
  if (!decision) return undefined;
  return { ...decision, capability: finalAuthority && item.status !== "signed" ? "review" : "approve",
    reason: !finalAuthority ? "طلب معلق يتيح الموافقة الأولية؛ لا يمنح قرارًا نهائيًا"
      : item.status === "signed" ? "توقيع الموظف مسجل وتملك سلطة القرار النهائي" : "طلب يحتاج مراجعة شروط السلفة وإرساله للتوقيع قبل الاعتماد النهائي" };
}

/** Missing dates stay null even when other dates have real sales. */
export function operationsSalesSeries(dates: string[], rows: { date: string; branchId: string; sales: number }[]) {
  return dates.map(date => {
    const recorded = rows.filter(row => row.date === date);
    return { date, value: recorded.length ? recorded.reduce((sum, row) => sum + row.sales, 0) : null,
      recordedBranches: new Set(recorded.map(row => row.branchId)).size };
  });
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
    branch_complaint: "complaintId",
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
    canonicalId: `${sourceType}:${sourceId}`,
    reason: `الحالة المسجلة: ${status}`,
    actions: [{ label: "عرض المصدر", href, capability: "read" }],
  };
}