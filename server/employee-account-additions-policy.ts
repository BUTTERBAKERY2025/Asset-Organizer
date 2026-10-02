import { z } from "zod";
import { sql } from "drizzle-orm";
import { MODULE_ACTIONS, SYSTEM_MODULES, userPermissionOverrides } from "@shared/schema";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS, type AdminAccountAddition, type EmployeeAccountPolicy } from "@shared/employee-account-delegation";
import { DelegationError, permissionsWithin } from "./employee-account-delegation-policy";

/** Verified phase-2 end-to-end contextual capability map. No operational module
 * is advertised as branch-contextual merely because it has branch filters. */
export const ADDITION_BRANCH_MODULES = [
  { module: "hr_documents", actions: ["view", "create", "edit", "delete"] },
  { module: "hr_evaluations", actions: ["view", "create", "edit", "approve", "delete"] },
];
export const ADDITION_CAPABILITIES = {
  globalModules: SYSTEM_MODULES.map(module => ({ module, actions: [...MODULE_ACTIONS] })),
  branchModules: ADDITION_BRANCH_MODULES,
  unsupportedScopes: ["department", "self", "assigned_tasks"],
  globalScopeLabel: "عام — لا يقيّد الإجراء بفرع الموظف",
};
const dateInput = z.string().datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), "Invalid date").nullable().optional();
export const additionInput = z.object({
  module: z.enum(SYSTEM_MODULES), action: z.enum(MODULE_ACTIONS), allow: z.boolean(),
  scopeType: z.enum(["global", "branch"]), branchId: z.string().min(1).max(100).nullable().optional(),
  startsAt: dateInput, endsAt: dateInput, reason: z.string().trim().min(1).max(2000),
}).strict();
export const additionUpdateInput = additionInput.extend({ expectedRevision: z.string().uuid() }).strict();
export const additionDeleteInput = z.object({
  reason: z.string().trim().min(1).max(2000), expectedRevision: z.string().uuid(),
}).strict();
export function validateAddition(input: z.infer<typeof additionInput>, employeeBranchId: string) {
  if (input.scopeType === "global" && input.branchId != null)
    throw new DelegationError(400, "UNSUPPORTED_ADDITION_SCOPE", "الإضافة العامة لا تحمل قيد فرع");
  if (input.scopeType === "branch") {
    if (!ADDITION_BRANCH_MODULES.some(p => p.module === input.module && p.actions.includes(input.action)))
      throw new DelegationError(400, "UNSUPPORTED_ADDITION_SCOPE", "هذه الوحدة أو الإجراء لا يدعم نطاق الفرع المثبت عبر مساراته");
    if (input.branchId !== employeeBranchId)
      throw new DelegationError(403, "BRANCH_FORBIDDEN", "فرع الإضافة يجب أن يطابق فرع الموظف المسجل");
  }
  if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt))
    throw new DelegationError(400, "INVALID_VALIDITY", "نهاية الإضافة يجب أن تكون بعد بدايتها");
}

export type AdditionRecord = {
  id: number; employeeId: number; userId: string; employeeBranchId: string;
  revision: string; snapshot: unknown; createdBy: string; createdAt: Date | string; updatedAt: Date | string;
  overrideUserId: string; permissionId: number; module: string; action: string; allow: boolean;
  branchId: string | null; departmentId: number | null; startsAt: Date | string | null;
  endsAt: Date | string | null; reason: string | null; grantedBy: string | null;
  overrideCreatedAt: Date | string | null; overrideUpdatedAt: Date | string | null;
};
const iso = (date: Date | string | null) => date === null ? null : new Date(date).toISOString();
/** Exact persisted identity/provenance, not an inferred classification by name. */
export function additionFingerprint(row: AdditionRecord) {
  return {
    id: row.id, userId: row.overrideUserId, permissionId: row.permissionId, module: row.module,
    action: row.action, allow: row.allow, branchId: row.branchId, departmentId: row.departmentId,
    startsAt: iso(row.startsAt), endsAt: iso(row.endsAt), reason: row.reason,
    grantedBy: row.grantedBy, createdAt: iso(row.overrideCreatedAt), updatedAt: iso(row.overrideUpdatedAt),
  };
}
export function additionIntegrity(row: AdditionRecord) {
  return JSON.stringify(row.snapshot) === JSON.stringify(additionFingerprint(row))
    // JSONB key ordering is not significant.
    || (row.snapshot !== null && typeof row.snapshot === "object"
      && Object.keys(row.snapshot).length === Object.keys(additionFingerprint(row)).length
      && Object.entries(additionFingerprint(row)).every(([key, value]) => (row.snapshot as any)[key] === value));
}
export function additionIsDelegationSafe(row: AdditionRecord, employee: { id: number; linkedUserId: string | null; branchId: string }, policy: EmployeeAccountPolicy) {
  const permission = [{ module: row.module, actions: [row.action] }];
  return row.employeeId === employee.id && row.userId === employee.linkedUserId
    && row.overrideUserId === employee.linkedUserId && row.employeeBranchId === employee.branchId
    && additionIntegrity(row) && row.departmentId === null
    // No safe operational module is contextual end-to-end in this release.
    // Do not classify an unsupported branch label as a managed safe grant.
    && row.branchId === null
    && permissionsWithin(permission, EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS)
    && permissionsWithin(permission, policy.permissions);
}
export function additionDTO(row: AdditionRecord): AdminAccountAddition {
  return {
    id: row.id, module: row.module, action: row.action, allow: row.allow,
    scopeType: row.branchId === null ? "global" : "branch", branchId: row.branchId,
    departmentId: row.departmentId,
    startsAt: iso(row.startsAt), endsAt: iso(row.endsAt), reason: row.reason ?? "",
    revision: row.revision, createdBy: row.createdBy, createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!, integrity: additionIntegrity(row) ? "managed" : "changed",
  };
}
type SqlTx = { execute: (query: any) => Promise<any> };
export async function additionsStorageReady(tx: SqlTx) {
  const result = await tx.execute(sql`SELECT to_regclass('public.employee_account_additions') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'user_permission_overrides' AND column_name = 'starts_at') AS ready`);
  return Boolean(result.rows[0]?.ready);
}
export async function requireAdditionsStorage(tx: SqlTx) {
  if (!await additionsStorageReady(tx))
    throw new DelegationError(503, "migration_required", "يلزم الترحيل اليدوي 054 لإدارة الإضافات المستقلة");
}
export async function readManagedAdditions(tx: SqlTx, userIds: string[], knownReady = false): Promise<AdditionRecord[]> {
  if (!userIds.length || (!knownReady && !await additionsStorageReady(tx))) return [];
  const result = await tx.execute(sql`SELECT m.override_id AS id, m.employee_id AS "employeeId",
    m.user_id AS "userId", m.employee_branch_id AS "employeeBranchId", m.revision::text,
    m.snapshot, m.created_by AS "createdBy", m.created_at AS "createdAt", m.updated_at AS "updatedAt",
    o.user_id AS "overrideUserId", o.permission_id AS "permissionId", p.module, p.action, o.allow,
    o.branch_id AS "branchId", o.department_id AS "departmentId", o.starts_at AS "startsAt",
    o.expires_at AS "endsAt", o.reason, o.granted_by AS "grantedBy",
    o.created_at AS "overrideCreatedAt", o.updated_at AS "overrideUpdatedAt"
    FROM public.employee_account_additions m
    JOIN public.user_permission_overrides o ON o.id = m.override_id
    JOIN public.permissions p ON p.id = o.permission_id
    WHERE o.user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY m.override_id`);
  // execute() bypasses Drizzle's column decoders and returns PostgreSQL
  // timestamp-without-time-zone strings. Parsing those with new Date() would
  // use the Node process timezone, unlike INSERT/UPDATE RETURNING and the
  // runtime resolver, which decode these exact columns as UTC. Apply the same
  // schema decoders here before comparing immutable provenance. Metadata dates
  // are timestamptz and already carry their explicit offset.
  return (result.rows as AdditionRecord[]).map(row => ({
    ...row,
    startsAt: row.startsAt === null ? null : userPermissionOverrides.startsAt.mapFromDriverValue(row.startsAt) as Date,
    endsAt: row.endsAt === null ? null : userPermissionOverrides.expiresAt.mapFromDriverValue(row.endsAt) as Date,
    overrideCreatedAt: row.overrideCreatedAt === null ? null : userPermissionOverrides.createdAt.mapFromDriverValue(row.overrideCreatedAt) as Date,
    overrideUpdatedAt: row.overrideUpdatedAt === null ? null : userPermissionOverrides.updatedAt.mapFromDriverValue(row.overrideUpdatedAt) as Date,
  }));
}