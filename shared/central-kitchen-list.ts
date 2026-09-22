export type CentralKitchenFacetTotals = {
  all: number;
  requested: number;
  approved: number;
  prepared: number;
  dispatched: number;
  overdue: number;
  discrepancies: number;
  dueToday: number;
  archive: number;
};

export function centralKitchenPageMeta(total: number, requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.max(1, requestedPage), pageSize, total, totalPages };
}

export function buildCentralKitchenCounts(facets: CentralKitchenFacetTotals) {
  return {
    attention: facets.requested + facets.overdue + facets.discrepancies,
    requested: facets.requested,
    approved: facets.approved,
    prepared: facets.prepared,
    dispatched: facets.dispatched,
    archive: facets.archive,
    all: facets.all,
    new: facets.requested,
    overdue: facets.overdue,
    dueToday: facets.dueToday,
    openDiscrepancies: facets.discrepancies,
  };
}