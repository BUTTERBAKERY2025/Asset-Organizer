/** A current-state, read-only projection; quantities are in the request's unit. */
export type ProductionItemCoverage = {
  status: "calculated" | "unknown" | "not_applicable";
  reason: string | null;
  persistedReserved: number | null;
  proposedFreeStock: number | null;
  prospectiveInProgress: number | null;
  remainingProductionNeed: number | null;
  /** In-progress is prospective only and is never counted as posted stock. */
  inProgressGuaranteed: false;
};

export type ProductionCoverageMetadata = {
  status: "calculated" | "unknown";
  scope: "all_open_eligible_requests_current_state";
  complete: boolean;
  candidateLimit: number;
  candidateCount: number;
  note: string;
};