import {
  checkPermissionDecision, permissionModuleMatches,
  type PermissionContext, type PermissionDecisionSnapshot, type PermissionDecisionTuple,
} from "./permission-decision";

export interface BranchTemplateBase {
  branchId: string;
  permissions: { module: string; actions: string[] }[];
}

/**
 * Pure scoped base replacement. Independent overrides are never deleted.
 * Existing direct/inherited authority is unchanged outside the selected branch.
 * Unknown scope fails closed rather than treating a navigation union as a grant.
 * Not enabled in the live resolver until route-context coverage is verified.
 */
export function branchTemplateSnapshot(
  original: PermissionDecisionSnapshot,
  bases: readonly BranchTemplateBase[],
  context: PermissionContext,
): PermissionDecisionSnapshot {
  if (!bases.length) return original;
  if (new Set(bases.map(base => base.branchId)).size !== bases.length
      || bases.some(base => !base.branchId))
    throw new Error("Ambiguous branch template bases");
  const selected = bases.find(base => base.branchId === context.branchId);
  if (context.branchId && !selected) return original;
  const overlays = original.tuples.filter(tuple =>
    tuple.source === "override_grant" || tuple.source === "override_deny");
  if (!selected) {
    // Only authority present in every replacement may remain globally usable.
    // Check the full original base rather than admitting a new scoped grant.
    const remaining = original.tuples.filter(tuple => {
      if (tuple.source === "override_grant" || tuple.source === "override_deny") return true;
      return bases.every(base => base.permissions.some(permission =>
        permissionModuleMatches(permission.module, tuple.module)
        && permission.actions.includes(tuple.action)));
    });
    return { ...original, tuples: remaining };
  }
  const tuples: PermissionDecisionTuple[] = selected.permissions.flatMap(permission =>
    permission.actions.map(action => ({
      module: permission.module, action, source: "direct" as const,
      scopeType: "branch", branchId: selected.branchId, departmentId: null,
      startDate: null, endDate: null, expiresAt: null, isActive: true, deny: false,
    })));
  return { ...original, tuples: [...tuples, ...overlays] };
}

export function checkBranchTemplateDecision(
  original: PermissionDecisionSnapshot, bases: readonly BranchTemplateBase[],
  module: string, action: string, context: PermissionContext,
): boolean {
  return checkPermissionDecision(branchTemplateSnapshot(original, bases, context), module, action, context);
}