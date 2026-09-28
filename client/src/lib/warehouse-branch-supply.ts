export type WarehouseSupplyIntent = {
  shouldCreate: boolean;
  fromBranchSupply: boolean;
};

/** Both the list action and an exact-row deep link use the same receiving scope. */
export function canReceiveBranchSupplyTransfer(
  transfer: { status: string; sourceBranchId: string; destinationBranchId: string },
  isBranchManager: boolean,
  canEditSupply: boolean,
  branches: Array<{ id: string }>,
): boolean {
  return isBranchManager && canEditSupply && transfer.status === "in_transit"
    && transfer.sourceBranchId === "main_warehouse"
    && branches.some(branch => branch.id === transfer.destinationBranchId);
}

export function parseWarehouseSupplyIntent(search: string): WarehouseSupplyIntent {
  const params = new URLSearchParams(search);
  return {
    shouldCreate: params.get("create") === "1",
    fromBranchSupply: params.get("from") === "branch-supply",
  };
}

export function consumeWarehouseCreateIntent(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("create");
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function resolveVisibleBranchFilter(
  filterBranch: string,
  branches: Array<{ id: string }>,
): string | null {
  if (!filterBranch || filterBranch === "all") return null;
  return branches.some(branch => branch.id === filterBranch) ? filterBranch : null;
}

export function resolveWarehouseCreateDestination(
  filterBranch: string,
  branches: Array<{ id: string }>,
  userBranchId?: string | null,
): string | null {
  return resolveVisibleBranchFilter(filterBranch, branches)
    || (userBranchId && branches.some(branch => branch.id === userBranchId) ? userBranchId : null);
}