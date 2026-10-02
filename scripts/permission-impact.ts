// Offline only: the sole application import is the pure decision resolver.
import { z } from "zod";
import {
  checkPermissionDecision,
  hasPermissionDecisionDeny,
  isPermissionTupleCurrent,
  normalizePermissionDecisionSnapshot,
  permissionModuleMatches,
  type PermissionContext,
  type PermissionDecisionSnapshot,
  type PermissionDecisionTuple,
} from "../server/permission-decision";

const identifier = z.string().min(1);
const nullableIdentifier = identifier.nullable();
const department = z.number().int().positive().nullable();
// Row timestamps deliberately reach the real resolver, including malformed
// historical timestamps. It fails closed for grants, conservatively for denies.
const rowTime = z.string().nullable();
const contextSchema = z.object({
  branchId: nullableIdentifier.optional(),
  departmentId: department.optional(),
}).strict();

export const permissionImpactInputSchema = z.object({
  schemaVersion: z.literal(1),
  evaluatedAt: z.string().datetime({ offset: true }),
  baselineId: identifier,
  accounts: z.array(z.object({
    userId: identifier,
    role: identifier,
    sourceMode: z.enum(["direct", "inherit"]).nullable(),
    direct: z.array(z.object({
      module: identifier, actions: z.array(identifier),
    }).strict()),
    roles: z.array(z.object({
      module: identifier, action: identifier, permissionId: z.number().int().positive(),
      scopeType: identifier, branchId: nullableIdentifier, departmentId: department,
      startDate: rowTime, endDate: rowTime, isActive: z.boolean(),
    }).strict()),
    overrides: z.array(z.object({
      module: identifier, action: identifier, permissionId: z.number().int().positive(),
      allow: z.boolean(), branchId: nullableIdentifier, departmentId: department,
      expiresAt: rowTime,
    }).strict()),
  }).strict()),
  checks: z.array(z.object({
    id: identifier,
    userId: identifier,
    module: identifier,
    action: identifier,
    context: contextSchema,
    // An observed/exported old decision for THIS exact check, not a guessed
    // reimplementation of an unspecified historical auth/storage revision.
    oldAllowed: z.boolean(),
  }).strict()),
}).strict();

export type PermissionImpactInput = z.infer<typeof permissionImpactInputSchema>;
export type PermissionImpactReason =
  | "admin-bypass" | "explicit-deny" | "grant" | "no-matching-grant"
  | "unknown-context" | "expired" | "not-started" | "inactive"
  | "invalid-time" | "invalid-scope" | "scope-mismatch" | "source-empty";

function singleton(snapshot: PermissionDecisionSnapshot, tuple: PermissionDecisionTuple) {
  return { ...snapshot, tuples: [tuple] };
}

function missingContext(tuple: PermissionDecisionTuple, context: PermissionContext): boolean {
  const needsBranch = tuple.branchId !== null
    || tuple.scopeType === "branch" || tuple.scopeType === "branch_department";
  const needsDepartment = tuple.departmentId !== null
    || tuple.scopeType === "department" || tuple.scopeType === "branch_department";
  // A known mismatching dimension already places this tuple outside the
  // resource, even when the other dimension is unknown.
  if (tuple.branchId !== null && context.branchId != null && tuple.branchId !== context.branchId) return false;
  if (tuple.departmentId !== null && context.departmentId != null && tuple.departmentId !== context.departmentId) return false;
  return (needsBranch && context.branchId == null)
    || (needsDepartment && context.departmentId == null);
}

function explain(
  snapshot: PermissionDecisionSnapshot, module: string, action: string,
  context: PermissionContext, now: number,
): { allowed: boolean; reasons: PermissionImpactReason[] } {
  const allowed = checkPermissionDecision(snapshot, module, action, context, now);
  const reasons = new Set<PermissionImpactReason>();
  const denied = hasPermissionDecisionDeny(snapshot, module, action, context, now);
  if (denied) reasons.add("explicit-deny");
  if (allowed) reasons.add("grant");
  else if (!denied) reasons.add("no-matching-grant");
  const base = snapshot.tuples.filter(tuple =>
    tuple.source === (snapshot.resolvedSourceMode === "direct" ? "direct" : "role"));
  if (base.length === 0) reasons.add("source-empty");
  for (const tuple of snapshot.tuples.filter(tuple =>
    permissionModuleMatches(tuple.module, module) && tuple.action === action)) {
    if (!tuple.isActive) { reasons.add("inactive"); continue; }
    const times = [tuple.startDate, tuple.endDate, tuple.expiresAt];
    if (times.some(time => time !== null && !Number.isFinite(new Date(time).getTime()))) {
      reasons.add("invalid-time");
    } else {
      if ([tuple.endDate, tuple.expiresAt].some(time => time !== null && new Date(time).getTime() <= now)) reasons.add("expired");
      if (tuple.startDate !== null && new Date(tuple.startDate).getTime() > now) reasons.add("not-started");
    }
    if (!isPermissionTupleCurrent(tuple, now)) continue;
    if (!["global", "branch", "department", "branch_department"].includes(tuple.scopeType)
      || (["department", "branch_department"].includes(tuple.scopeType) && tuple.departmentId === null)) {
      reasons.add("invalid-scope");
    }
    if (missingContext(tuple, context)) reasons.add("unknown-context");
    const scoped = tuple.deny
      ? hasPermissionDecisionDeny(singleton(snapshot, tuple), module, action, context, now)
      : checkPermissionDecision(singleton(snapshot, tuple), module, action, context, now);
    if (!scoped && !missingContext(tuple, context)) reasons.add("scope-mismatch");
  }
  return { allowed, reasons: [...reasons].sort() };
}

export function comparePermissionImpact(raw: unknown) {
  const input = permissionImpactInputSchema.parse(raw);
  const now = Date.parse(input.evaluatedAt);
  if (!Number.isFinite(now)) throw new Error("evaluatedAt must be a finite timestamp");
  const accounts = new Map<string, typeof input.accounts[number]>();
  const snapshots = new Map<string, PermissionDecisionSnapshot>();
  for (const account of input.accounts) {
    if (accounts.has(account.userId)) throw new Error(`Duplicate account identifier: ${account.userId}`);
    accounts.set(account.userId, account);
    snapshots.set(account.userId, normalizePermissionDecisionSnapshot(account, now));
  }
  const checkIds = new Set<string>();
  const rows = input.checks.map(check => {
    if (checkIds.has(check.id)) throw new Error(`Duplicate check identifier: ${check.id}`);
    checkIds.add(check.id);
    const account = accounts.get(check.userId);
    const snapshot = snapshots.get(check.userId);
    if (!account || !snapshot) throw new Error(`Unknown account identifier in check: ${check.userId}`);
    const decision = account.role === "admin"
      ? { allowed: true, reasons: ["admin-bypass"] as PermissionImpactReason[] }
      : explain(snapshot, check.module, check.action, check.context, now);
    const change = check.oldAllowed === decision.allowed ? "unchanged"
      : decision.allowed ? "gained" : "lost";
    return {
      checkId: check.id, userId: check.userId, module: check.module, action: check.action,
      context: check.context, oldAllowed: check.oldAllowed, newAllowed: decision.allowed,
      change, sourceMode: snapshot.sourceMode, resolvedSourceMode: snapshot.resolvedSourceMode,
      reasons: decision.reasons,
    };
  }).sort((a, b) => a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0);
  const reasonCounts: Partial<Record<PermissionImpactReason, number>> = {};
  for (const row of rows) for (const reason of row.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  return {
    schemaVersion: 1,
    baselineId: input.baselineId,
    evaluatedAt: input.evaluatedAt,
    comparisonLayer: "pure-permission-decision-with-admin-bypass",
    oldDecisionSource: "supplied-per-check",
    counts: {
      suppliedAccounts: accounts.size,
      checkedAccounts: new Set(rows.map(row => row.userId)).size,
      checks: rows.length,
      oldAllowed: rows.filter(row => row.oldAllowed).length,
      newAllowed: rows.filter(row => row.newAllowed).length,
      lost: rows.filter(row => row.change === "lost").length,
      gained: rows.filter(row => row.change === "gained").length,
      unchanged: rows.filter(row => row.change === "unchanged").length,
    },
    reasonCounts,
    affectedAccountIds: [...new Set(rows.filter(row => row.change !== "unchanged").map(row => row.userId))].sort(),
    uncheckedAccountIds: [...accounts.keys()].filter(id => !rows.some(row => row.userId === id)).sort(),
    rows,
  };
}