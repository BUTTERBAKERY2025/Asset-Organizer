export type WarehouseSupplyIntent = {
  shouldCreate: boolean;
  fromBranchSupply: boolean;
};

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