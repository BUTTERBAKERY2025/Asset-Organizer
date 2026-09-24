/**
 * Client-side helpers for the administrative catalogue-import review.
 *
 * These helpers deliberately do not infer identities. A reviewer action is
 * emitted only after its corresponding acknowledgement has been selected.
 */
export type CatalogueNamespace = "products" | "warehouse";
export type CatalogueImportAction =
  | "adopt_code"
  | "add"
  | "deactivate"
  | "hard_delete"
  | "defer";
export type CatalogueAvailabilityDisposition = "active_priced" | "inactive_pending_price";

export interface CatalogueCurrentRecord {
  id?: number | string | null;
  name?: string | null;
  sku?: string | number | null;
  unit?: string | null;
  currentBalance?: unknown;
  currentStock?: unknown;
}

export interface CatalogueReviewRow {
  namespace: CatalogueNamespace;
  status: "exact_match" | "review" | "add_candidate" | "legacy_review";
  sourceCode: string | number | null;
  sourceName: string | null;
  sourceUnit: string | null;
  currentId?: number | null;
  currentRecord?: CatalogueCurrentRecord | null;
  currentRecords?: CatalogueCurrentRecord[];
  candidateCurrentRecord?: CatalogueCurrentRecord | null;
  currentBalance?: unknown;
  currentUnit?: string | null;
  matchMethod?: "sku" | "name_recode_review" | "name_collision" | "none" | "legacy";
  candidateCurrentId?: number | null;
  categories?: Array<{ category: string; matchedBy?: "canonical_name" | "source_alias" }>;
  aliases?: string[];
  issues?: Array<{ code: string; message: string }>;
}

export interface CatalogueReviewDecision {
  action: CatalogueImportAction;
  /** The internal DB ID selected by the reviewer, never a source workbook code. */
  currentId?: number;
  category?: string;
  reason?: string;
  identityConfirmed?: boolean;
  adoptSourceName?: boolean;
  /** Alias-derived usage sections explicitly chosen by the reviewer. */
  approvedAliasSections?: string[];
  price?: number;
  availabilityDisposition?: CatalogueAvailabilityDisposition;
  legacyReviewed?: boolean;
}

export interface CatalogueImportApproval {
  namespace: CatalogueNamespace;
  action: CatalogueImportAction;
  sourceCode?: string | number;
  currentId?: number;
  category?: string;
  price?: number;
  availabilityDisposition?: CatalogueAvailabilityDisposition;
  approvedAliasSections?: string[];
  reason?: string;
  identityAcknowledgement?: "MANUAL_IDENTITY_CONFIRMED";
  adoptSourceName?: boolean;
  reviewAcknowledgement?: "LEGACY_RECORD_REVIEWED";
}

export function reviewRowKey(row: CatalogueReviewRow): string {
  return row.status === "legacy_review"
    ? `${row.namespace}:legacy:${row.currentId ?? "unknown"}`
    : `${row.namespace}:source:${String(row.sourceCode ?? "unknown")}`;
}

export function canManuallyAdoptCode(row: CatalogueReviewRow): boolean {
  return row.status !== "exact_match"
    && row.status !== "legacy_review"
    && row.sourceCode !== null
    && row.sourceCode !== undefined;
}

export function aliasDerivedUsageSections(row: CatalogueReviewRow): string[] {
  return Array.from(new Set(
    (row.categories ?? [])
      .filter((category) => category.matchedBy === "source_alias")
      .map((category) => category.category.trim())
      .filter(Boolean),
  )).sort();
}

function approvedAliasSections(
  row: CatalogueReviewRow,
  decision: CatalogueReviewDecision,
): string[] | null {
  const allowed = new Set(aliasDerivedUsageSections(row));
  const selected = Array.from(new Set(decision.approvedAliasSections ?? []));
  return selected.every((section) => allowed.has(section)) ? selected.sort() : null;
}

/**
 * Returns records exposed by the review payload only. The result is a picker
 * list, not a proposed identity: the decision remains empty until the reviewer
 * explicitly selects an ID.
 */
export function selectableCurrentRecords(
  row: CatalogueReviewRow,
  currentCatalogues: Partial<Record<CatalogueNamespace, CatalogueCurrentRecord[]>> = {},
  legacyRows: CatalogueReviewRow[] = [],
): CatalogueCurrentRecord[] {
  const records = [
    ...(currentCatalogues[row.namespace] ?? []),
    ...(row.currentRecords ?? []),
    row.currentRecord ?? null,
    row.candidateCurrentRecord ?? null,
    ...legacyRows
      .filter((legacy) => legacy.namespace === row.namespace)
      .map((legacy) => legacy.currentRecord ?? ({
        id: legacy.currentId,
        unit: legacy.currentUnit,
      } satisfies CatalogueCurrentRecord)),
  ];
  const byId = new Map<number, CatalogueCurrentRecord>();
  for (const record of records) {
    const id = Number(record?.id);
    if (Number.isInteger(id) && id > 0 && !byId.has(id)) byId.set(id, record!);
  }
  return Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

export function approvalFromDecision(
  row: CatalogueReviewRow,
  decision: CatalogueReviewDecision | undefined,
): CatalogueImportApproval | null {
  if (!decision) return null;

  if (
    decision.action === "adopt_code"
    && canManuallyAdoptCode(row)
    && Number.isInteger(decision.currentId)
    && Number(decision.currentId) > 0
    && decision.identityConfirmed
    && !!decision.reason?.trim()
  ) {
    const aliases = approvedAliasSections(row, decision);
    if (!aliases) return null;
    return {
      namespace: row.namespace,
      action: "adopt_code",
      sourceCode: row.sourceCode!,
      currentId: decision.currentId,
      identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
      reason: decision.reason.trim(),
      ...(decision.adoptSourceName ? { adoptSourceName: true } : {}),
      ...(aliases.length ? { approvedAliasSections: aliases } : {}),
    };
  }

  if (
    decision.action === "add"
    && row.status === "add_candidate"
    && row.sourceCode !== null
    && row.sourceCode !== undefined
    && !!decision.category?.trim()
  ) {
    const pricedAndActive = decision.availabilityDisposition === "active_priced"
      && typeof decision.price === "number"
      && Number.isFinite(decision.price)
      && decision.price > 0;
    const inactivePendingPrice = decision.availabilityDisposition === "inactive_pending_price"
      && decision.price === undefined;
    const aliases = approvedAliasSections(row, decision);
    if ((!pricedAndActive && !inactivePendingPrice) || !aliases) return null;
    return {
      namespace: row.namespace,
      action: "add",
      sourceCode: row.sourceCode,
      category: decision.category.trim(),
      availabilityDisposition: decision.availabilityDisposition,
      ...(pricedAndActive ? { price: decision.price } : {}),
      ...(aliases.length ? { approvedAliasSections: aliases } : {}),
    };
  }

  if (
    row.status === "legacy_review"
    && ["deactivate", "hard_delete", "defer"].includes(decision.action)
    && typeof row.currentId === "number"
    && !!decision.reason?.trim()
    && decision.legacyReviewed
  ) {
    return {
      namespace: row.namespace,
      action: decision.action,
      currentId: row.currentId,
      reason: decision.reason.trim(),
      reviewAcknowledgement: "LEGACY_RECORD_REVIEWED",
    };
  }

  return null;
}

export function buildCatalogueImportApprovals(
  rows: CatalogueReviewRow[],
  decisions: Record<string, CatalogueReviewDecision>,
): CatalogueImportApproval[] {
  const sourceApprovals = rows
    .filter((row) => row.status !== "legacy_review")
    .map((row) => approvalFromDecision(row, decisions[reviewRowKey(row)]))
    .filter((approval): approval is CatalogueImportApproval => approval !== null);
  const adoptedTargets = new Set(sourceApprovals
    .filter((approval) => approval.action === "adopt_code")
    .map((approval) => `${approval.namespace}:${approval.currentId}`));
  const legacyApprovals = rows
    .filter((row) => row.status === "legacy_review")
    .filter((row) => !adoptedTargets.has(`${row.namespace}:${row.currentId}`))
    .map((row) => approvalFromDecision(row, decisions[reviewRowKey(row)]))
    .filter((approval): approval is CatalogueImportApproval => approval !== null);
  return [...sourceApprovals, ...legacyApprovals];
}

export function unresolvedCatalogueRows(
  rows: CatalogueReviewRow[],
  decisions: Record<string, CatalogueReviewDecision>,
): CatalogueReviewRow[] {
  const sourceApprovals = rows
    .filter((row) => row.status !== "legacy_review")
    .map((row) => approvalFromDecision(row, decisions[reviewRowKey(row)]))
    .filter((approval): approval is CatalogueImportApproval => approval !== null);
  const adoptedTargets = new Set(sourceApprovals
    .filter((approval) => approval.action === "adopt_code")
    .map((approval) => `${approval.namespace}:${approval.currentId}`));
  return rows.filter((row) => {
    if (row.status === "exact_match") return false;
    if (row.status === "legacy_review" && adoptedTargets.has(`${row.namespace}:${row.currentId}`)) return false;
    return !approvalFromDecision(row, decisions[reviewRowKey(row)]);
  });
}

export function createCatalogueApplyIdempotencyKey(planId: string): string {
  const entropy =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `catalogue-import-${planId}-${entropy}`.slice(0, 128);
}