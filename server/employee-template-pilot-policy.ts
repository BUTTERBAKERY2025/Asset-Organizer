import { z } from "zod";
import { MODULE_ACTIONS, SYSTEM_MODULES } from "@shared/schema";
import type { DelegatedPermission, PilotAuthority, PilotPermissionSource } from "@shared/employee-account-delegation";
import { normalizePermissionDecisionSnapshot, isPermissionTupleCurrent, checkPermissionDecision,
  evaluatePermissionDecision, type PermissionDecisionSnapshot, type PermissionDecisionTuple } from "./permission-decision";

const positive = z.number().int().positive().max(2147483647);
export const pilotQuery = z.object({ templateId: z.coerce.number().pipe(positive), version: z.coerce.number().pipe(positive) }).strict();
export const pilotInput = z.object({
  templateId: positive, version: positive, branchId: z.string().min(1).max(100),
  reason: z.string().trim().min(1).max(2000), expectedComparisonRevision: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgeChanges: z.literal(true),
}).strict();
const iso = (date: Date | string | null) => {
  if (date === null) return null;
  const value = new Date(date);
  // Preserve malformed legacy evidence alongside temporalState="invalid".
  // Never fabricate a valid timestamp or crash an otherwise blocked preview.
  return Number.isFinite(value.getTime()) ? value.toISOString() : String(date);
};
export function tupleTemporalState(tuple: PermissionDecisionTuple, now: number): PilotPermissionSource["temporalState"] {
  if (!tuple.isActive) return "inactive";
  const starts = tuple.startDate === null ? null : new Date(tuple.startDate).getTime();
  const ends = [tuple.endDate, tuple.expiresAt].filter(t => t !== null).map(t => new Date(t!).getTime());
  if ((starts !== null && !Number.isFinite(starts)) || ends.some(t => !Number.isFinite(t))) return "invalid";
  if (ends.some(t => t <= now)) return "expired";
  if (starts !== null && starts > now) return "future";
  return isPermissionTupleCurrent(tuple, now) ? "active" : "inactive";
}
/** Replace ONLY the base input of the existing pure runtime resolver. */
export function predictTemplateSnapshot(before: PermissionDecisionSnapshot, base: DelegatedPermission[]) {
  return normalizePermissionDecisionSnapshot({
    userId: before.userId, sourceMode: "direct", direct: base,
    roles: before.tuples.filter(t => t.source === "role").map(t => ({
      module: t.module, action: t.action, permissionId: t.permissionId!, roleName: t.roleName,
      scopeType: t.scopeType, branchId: t.branchId, departmentId: t.departmentId,
      startDate: t.startDate, endDate: t.endDate, isActive: t.isActive,
    })),
    overrides: before.tuples.filter(t => t.source === "override_grant" || t.source === "override_deny").map(t => ({
      module: t.module, action: t.action, permissionId: t.permissionId!, allow: !t.deny,
      branchId: t.branchId, departmentId: t.departmentId, startDate: t.startDate, expiresAt: t.expiresAt,
    })),
  }, before.capturedAt);
}
export function permissionGroups(pairs: Array<{ module: string; action: string }>): DelegatedPermission[] {
  const groups = new Map<string, Set<string>>();
  for (const p of pairs) {
    const actions = groups.get(p.module) ?? new Set<string>();
    actions.add(p.action); groups.set(p.module, actions);
  }
  return Array.from(groups).sort(([a], [b]) => a.localeCompare(b)).map(([module, actions]) => ({ module, actions: Array.from(actions).sort() }));
}
export function pilotAuthority(
  snapshot: PermissionDecisionSnapshot, branchId: string,
  decide: (module: string, action: string) => boolean,
  intrinsic: (module: string, action: string) => boolean,
): PilotAuthority {
  const keys = new Map<string, { module: string; action: string }>();
  for (const module of SYSTEM_MODULES) for (const action of MODULE_ACTIONS) keys.set(`${module}:${action}`, { module, action });
  for (const pair of evaluatePermissionDecision(snapshot, { branchId })) keys.set(`${pair.module}:${pair.action}`, pair);
  const effectivePermissions = permissionGroups(Array.from(keys.values()).filter(p => decide(p.module, p.action)));
  const sources: PilotPermissionSource[] = snapshot.tuples.map(tuple => ({
    module: tuple.module, action: tuple.action, source: tuple.source, scopeType: tuple.scopeType,
    branchId: tuple.branchId, departmentId: tuple.departmentId,
    startsAt: iso(tuple.startDate),
    endsAt: iso(tuple.expiresAt ?? tuple.endDate),
    temporalState: tupleTemporalState(tuple, snapshot.capturedAt),
    allowed: !tuple.deny && checkPermissionDecision({ ...snapshot, tuples: [tuple] },
      tuple.module, tuple.action, { branchId }) && decide(tuple.module, tuple.action),
  }));
  for (const pair of Array.from(keys.values())) if (intrinsic(pair.module, pair.action)) sources.push({
    ...pair, source: "intrinsic", scopeType: "role_policy", branchId, departmentId: null,
    startsAt: null, endsAt: null, temporalState: "active", allowed: decide(pair.module, pair.action),
  });
  sources.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { sourceMode: snapshot.sourceMode, effectivePermissions, sources };
}
export function authorityDifferences(before: PilotAuthority, after: PilotAuthority) {
  const flatten = (authority: PilotAuthority) => authority.effectivePermissions.flatMap(p =>
    p.actions.map(action => ({ module: p.module, action })));
  const old = flatten(before), next = flatten(after);
  const oldKeys = new Set(old.map(p => `${p.module}:${p.action}`)), nextKeys = new Set(next.map(p => `${p.module}:${p.action}`));
  return {
    additions: permissionGroups(next.filter(p => !oldKeys.has(`${p.module}:${p.action}`))),
    removals: permissionGroups(old.filter(p => !nextKeys.has(`${p.module}:${p.action}`))),
    retained: permissionGroups(next.filter(p => oldKeys.has(`${p.module}:${p.action}`))),
    retainedDenies: after.sources.filter(p => p.source === "override_deny"),
  };
}
export function nextDecisionBoundary(snapshot: PermissionDecisionSnapshot): string | null {
  const times = snapshot.tuples.flatMap(t => [t.startDate, t.endDate, t.expiresAt])
    .filter(t => t !== null).map(t => new Date(t!).getTime())
    .filter(time => Number.isFinite(time) && time > snapshot.capturedAt);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}