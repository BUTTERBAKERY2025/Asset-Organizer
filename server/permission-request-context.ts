import type { Request } from "express";
import type { PermissionContext } from "./permission-decision";

// These contexts are supplied by trusted route code, never extracted from input.
// A collection opts in only when its handler applies the resulting branch filter.
export type PermissionRequestContext =
  | ({ kind: "resource" } & PermissionContext)
  | ({ kind: "collection"; branchIds: string[] } & Pick<PermissionContext, "departmentId">)
  | { kind: "global" };
export type PermissionContextResolver = (
  req: Request,
) => PermissionRequestContext | null | Promise<PermissionRequestContext | null>;
export interface PermissionScopeConstraint {
  module: string;
  actions: string[];
  kind: PermissionRequestContext["kind"] | "unknown";
  branchIds: string[] | null;
}

export function getPermissionScopeConstraint(req: any): PermissionScopeConstraint | undefined {
  return req.permissionScopeConstraint;
}

export function intersectBranchConstraints(
  left: string[] | null, right: string[] | null,
): string[] | null {
  if (left === null) return right;
  if (right === null) return left;
  return left.filter(id => right.includes(id));
}

export function recordPermissionScopeConstraint(req: any, constraint: PermissionScopeConstraint): void {
  const previous = getPermissionScopeConstraint(req);
  req.permissionScopeConstraint = previous
    ? { ...constraint, branchIds: intersectBranchConstraints(previous.branchIds, constraint.branchIds) }
    : constraint;
}

export function isValidPermissionRequestContext(context: unknown): context is PermissionRequestContext {
  if (!context || typeof context !== "object") return false;
  const value = context as PermissionRequestContext;
  if (value.kind === "global") return true;
  if (value.kind !== "collection" && value.kind !== "resource") return false;
  if (value.departmentId != null && (!Number.isInteger(value.departmentId) || value.departmentId <= 0)) return false;
  return value.kind === "collection"
    ? Array.isArray(value.branchIds) && value.branchIds.every(id => typeof id === "string" && id.length > 0)
    : value.branchId == null || (typeof value.branchId === "string" && value.branchId.length > 0);
}
