/**
 * Standalone delivery desk eligibility. Module view permission is checked
 * separately; this does not grant delivery actions or embedded receipt access.
 */
export function canAccessDeliveryWorkspace(user: { role: string; jobTitle?: string | null } | null | undefined): boolean {
  return user?.role === "admin"
    || user?.role === "warehouse_keeper"
    || user?.role === "branch_manager"
    || (user?.role === "employee" && user.jobTitle === "delivery");
}

/** Branch desk is a recipient desk, not an alternate dispatch desk. */
export function branchDeliveryScope(
  _branchId: string | null | undefined,
  allowedBranches: string[] | null,
  source: { sourceType: string; sourceBranchId: string | null; destinationBranchId: string | null; destinationWarehouseId: number | null },
): { view: boolean; receive: boolean } {
  if (!allowedBranches?.length) return { view: false, receive: false };
  const receive = source.destinationWarehouseId == null && !!source.destinationBranchId
    && allowedBranches.includes(source.destinationBranchId);
  const ownReturn = source.sourceType === "reverse_movement" && !!source.sourceBranchId
    && allowedBranches.includes(source.sourceBranchId)
    && (source.destinationWarehouseId != null || source.destinationBranchId === "main_warehouse");
  return { view: receive || ownReturn, receive: !!receive };
}