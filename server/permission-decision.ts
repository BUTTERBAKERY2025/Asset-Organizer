// Pure permission decisions. No database, environment, role auto-grants or admin
// bypass live here. Auth retains those policies and supplies resource context.
export type PermissionSourceMode = "direct" | "inherit" | null;
export interface PermissionContext {
  branchId?: string | null;
  departmentId?: number | null;
}
export interface PermissionDecisionTuple {
  module: string;
  action: string;
  scopeType: string;
  branchId: string | null;
  departmentId: number | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  expiresAt: Date | string | null;
  isActive: boolean;
  deny: boolean;
  source: "direct" | "role" | "override_grant" | "override_deny";
  permissionId?: number;
  roleName?: string;
}
export interface PermissionDecisionSnapshot {
  userId: string;
  sourceMode: PermissionSourceMode;
  resolvedSourceMode: "direct" | "inherit";
  capturedAt: number;
  // Raw direct rows (including empty-action sentinels) are compatibility input
  // for intrinsic auth role policies, not a second effective grant source.
  directPermissions: { module: string; actions: string[] }[];
  tuples: PermissionDecisionTuple[];
}
export interface PermissionDecisionInput {
  userId: string;
  sourceMode: PermissionSourceMode;
  direct: { module: string; actions: string[] }[];
  roles: {
    module: string; action: string; permissionId: number; roleName?: string;
    scopeType: string; branchId: string | null; departmentId: number | null;
    startDate: Date | string | null; endDate: Date | string | null; isActive: boolean;
  }[];
  overrides: {
    module: string; action: string; permissionId: number; allow: boolean;
    branchId: string | null; departmentId: number | null; expiresAt: Date | string | null;
  }[];
}

export function normalizePermissionDecisionSnapshot(
  input: PermissionDecisionInput, now = Date.now(),
): PermissionDecisionSnapshot {
  if (input.sourceMode !== null && input.sourceMode !== "direct" && input.sourceMode !== "inherit") {
    throw new Error("Invalid or unavailable permission source mode; manual migration 050 is required");
  }
  const resolvedSourceMode = input.sourceMode ??
    (input.direct.some(p => p.actions.length > 0) ? "direct" : "inherit");
  const defaults = {
    scopeType: "global", branchId: null, departmentId: null,
    startDate: null, endDate: null, expiresAt: null, isActive: true, deny: false,
  };
  const tuples: PermissionDecisionTuple[] = resolvedSourceMode === "direct"
    ? input.direct.flatMap(p => p.actions.map(action => ({
      ...defaults, module: p.module, action, source: "direct" as const,
    })))
    : input.roles.map(p => ({ ...defaults, ...p, source: "role" as const }));
  tuples.push(...input.overrides.map(p => ({
    ...defaults, module: p.module, action: p.action, permissionId: p.permissionId,
    scopeType: p.branchId && p.departmentId ? "branch_department"
      : p.branchId ? "branch" : p.departmentId !== null ? "department" : "global",
    branchId: p.branchId, departmentId: p.departmentId, expiresAt: p.expiresAt,
    deny: !p.allow, source: p.allow ? "override_grant" as const : "override_deny" as const,
  })));
  return {
    userId: input.userId, sourceMode: input.sourceMode, resolvedSourceMode, capturedAt: now,
    directPermissions: input.direct.map(permission => ({ module: permission.module, actions: [...permission.actions] })),
    tuples,
  };
}

export function isPermissionTupleCurrent(tuple: PermissionDecisionTuple, now: number): boolean {
  if (!tuple.isActive || !Number.isFinite(now)) return false;
  // Invalid timestamps fail closed for grants; malformed denies remain blocking.
  const time = (value: Date | string) => new Date(value).getTime();
  const invalid = [tuple.startDate, tuple.endDate, tuple.expiresAt]
    .some(value => value !== null && !Number.isFinite(time(value)));
  if (invalid) return tuple.deny;
  return (tuple.startDate === null || time(tuple.startDate) <= now)
    && (tuple.endDate === null || time(tuple.endDate) > now)
    && (tuple.expiresAt === null || time(tuple.expiresAt) > now);
}

function matchesScope(tuple: PermissionDecisionTuple, context: PermissionContext): boolean {
  if (!["global", "branch", "department", "branch_department"].includes(tuple.scopeType)) return tuple.deny;
  // Missing required identifiers never turn a scoped grant into a global one.
  // Legacy branch scope with NULL branch means every concrete branch, not an
  // unscoped/global resource. Keep this distinction during gradual rollout.
  if ((tuple.scopeType === "branch" || tuple.scopeType === "branch_department")
    && tuple.branchId === null && context.branchId == null && !tuple.deny) return false;
  if ((tuple.scopeType === "department" || tuple.scopeType === "branch_department") && tuple.departmentId === null) return tuple.deny;
  // Both identifiers constrain a tuple, even if its scopeType names only one.
  if (tuple.branchId !== null) {
    if (context.branchId == null) { if (!tuple.deny) return false; }
    else if (context.branchId !== tuple.branchId) return false;
  }
  if (tuple.departmentId !== null) {
    if (context.departmentId == null) { if (!tuple.deny) return false; }
    else if (context.departmentId !== tuple.departmentId) return false;
  }
  return true;
}

// Historical directional aliases are mirrored, never canonicalized. Each alias
// keeps the original tuple's scope/time/deny. Role-specific auto-aliases stay auth's job.
export function permissionModuleMatches(storedModule: string, requestedModule: string): boolean {
  return storedModule === requestedModule
    || (storedModule === "attendance" && requestedModule === "attendance_check")
    || (storedModule === "pnl" && requestedModule === "pnl_dashboard")
    || (storedModule === "pnl_dashboard" && requestedModule === "pnl");
}

export function checkPermissionDecision(
  snapshot: PermissionDecisionSnapshot, module: string, action: string,
  context: PermissionContext = {}, now = snapshot.capturedAt,
): boolean {
  const matching = snapshot.tuples.filter(tuple =>
    permissionModuleMatches(tuple.module, module) && tuple.action === action
    && isPermissionTupleCurrent(tuple, now) && matchesScope(tuple, context));
  return !matching.some(tuple => tuple.deny) && matching.some(tuple => !tuple.deny);
}

export function hasPermissionDecisionDeny(
  snapshot: PermissionDecisionSnapshot, module: string, action: string,
  context: PermissionContext = {}, now = snapshot.capturedAt,
): boolean {
  return snapshot.tuples.some(tuple => tuple.deny
    && permissionModuleMatches(tuple.module, module) && tuple.action === action
    && isPermissionTupleCurrent(tuple, now) && matchesScope(tuple, context));
}

export function evaluatePermissionDecision(
  snapshot: PermissionDecisionSnapshot, context: PermissionContext = {}, now = snapshot.capturedAt,
): { module: string; action: string; allowed: boolean }[] {
  const keys = new Map<string, { module: string; action: string }>();
  for (const tuple of snapshot.tuples) {
    const modules = [tuple.module];
    if (tuple.module === "attendance") modules.push("attendance_check");
    if (tuple.module === "pnl") modules.push("pnl_dashboard");
    if (tuple.module === "pnl_dashboard") modules.push("pnl");
    for (const module of modules) keys.set(JSON.stringify([module, tuple.action]), { module, action: tuple.action });
  }
  return [...keys.values()].map(pair => ({
    ...pair, allowed: checkPermissionDecision(snapshot, pair.module, pair.action, context, now),
  }));
}