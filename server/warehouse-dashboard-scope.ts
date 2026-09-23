export interface WarehouseBranchFilter {
  singleBranchId?: string | null;
  branchIds?: readonly string[] | null;
}

export interface WarehouseTransferScopeFields {
  sourceBranchId?: string | null;
  destinationBranchId?: string | null;
}

export interface WarehouseMovementScopeFields {
  branchId?: string | null;
}

/**
 * Converts the route-level branch filter into the storage contract:
 * null means unrestricted, while an empty array means no branches.
 */
export function resolveWarehouseAllowedBranchIds(
  filter: WarehouseBranchFilter,
): string[] | null {
  if (filter.singleBranchId) return [filter.singleBranchId];
  if (filter.branchIds == null) return null;
  return Array.from(new Set(filter.branchIds));
}

export function warehouseTransferIsInScope(
  transfer: WarehouseTransferScopeFields,
  allowedBranchIds: readonly string[] | null,
): boolean {
  if (allowedBranchIds === null) return true;
  return (
    (!!transfer.sourceBranchId && allowedBranchIds.includes(transfer.sourceBranchId))
    || (!!transfer.destinationBranchId && allowedBranchIds.includes(transfer.destinationBranchId))
  );
}

export function warehouseMovementIsInScope(
  movement: WarehouseMovementScopeFields,
  allowedBranchIds: readonly string[] | null,
): boolean {
  if (allowedBranchIds === null) return true;
  return !!movement.branchId && allowedBranchIds.includes(movement.branchId);
}