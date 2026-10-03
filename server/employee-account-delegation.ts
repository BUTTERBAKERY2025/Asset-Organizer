import type { Express, RequestHandler } from "express";
import bcrypt from "bcrypt";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { ZodError, z } from "zod";
import {
  branchEmployees, branches, users, userBranchAccess, userPermissions,
  userAssignments, userPermissionOverrides, userPermissionSourceModes, portalSettings, systemAuditLogs,
  permissions as permissionCatalog,
} from "@shared/schema";
import {
  EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS, type DelegatedEmployeeAccount,
  type DelegatedPermission, type EmployeeAccountPolicy, type EmployeeAccountsResponse,
  type EmployeeAccountManagerSelectionResponse, type EmployeeAccountManagersResponse,
  type EmployeeTemplateAssignment, type EmployeeTemplateAssignmentResponse, type EmployeeJobTemplateSummary,
  type EmployeeTemplatePilotResponse,
} from "@shared/employee-account-delegation";
import { assignmentSnapshotRevision, eligibleTemplatePermissions, eligibleAdminTemplatePermissions, validateAdminCashierPermissions, templateAssignmentInput } from "./employee-template-assignment-policy";
import {
  ADDITION_CAPABILITIES, additionInput, additionUpdateInput, additionDeleteInput,
  additionDTO, additionFingerprint, additionIsDelegationSafe, requireAdditionsStorage,
  additionsStorageReady,
  readManagedAdditions, validateAddition, type AdditionRecord,
} from "./employee-account-additions-policy";
import { HQ_BRANCH_ID } from "@shared/employee-organization";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, invalidateAuthCache, contextualActionAllowed, intrinsicPermissionGranted } from "./auth";
import { pilotQuery, pilotInput, pilotAuthority, predictTemplateSnapshot, authorityDifferences,
  nextDecisionBoundary, permissionGroups } from "./employee-template-pilot-policy";
import { evaluatePermissionDecision, checkPermissionDecision, type PermissionDecisionSnapshot } from "./permission-decision";
import {
  actorMayManage, availableGeneratedUsername, branchMayManage, createAccountInput, DEFAULT_POLICY, DelegationError, deny,
  delegationTemplates, effectiveDelegatedPermissions, generatedCredentials, isLegacyAccountPath, permissionsInput,
  permissionsWithin, policyInput, statusInput, targetMayManage, validatePermissions, managerSelectionInput,
} from "./employee-account-delegation-policy";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const accountProjection = {
  id: users.id, username: users.username, role: users.role, branchId: users.branchId,
  jobTitle: users.jobTitle, isActive: users.isActive, updatedAt: users.updatedAt,
};
type Actor = Pick<typeof users.$inferSelect, keyof typeof accountProjection>;
type Employee = Pick<typeof branchEmployees.$inferSelect,
  "id" | "employeeName" | "branchId" | "linkedUserId" | "status" | "jobTitle">;
const POLICY_KEY = "employee_account_delegation.policy.v1";
const selectionKey = (id: string) => `employee_account_delegation.manager.${id}.v1`;
const storedSelectionInput = z.object({
  revision: z.string().min(1),
  selections: z.array(z.object({
    employeeId: z.number().int().positive().safe(),
    branchId: z.string(),
    linkedUserId: z.string().nullable(),
  }).strict()),
}).strict();
type Selection = z.infer<typeof storedSelectionInput>;
async function managerSelection(tx: Tx, managerId: string): Promise<Selection> {
  const [row] = await tx.select({ value: portalSettings.value }).from(portalSettings)
    .where(eq(portalSettings.key, selectionKey(managerId)));
  if (!row) return { revision: "0", selections: [] };
  try { return storedSelectionInput.parse(JSON.parse(row.value)); }
  catch { throw new DelegationError(503, "INVALID_SELECTION", "اختيارات الموظفين غير صالحة؛ راجع مسؤول النظام"); }
}
function individuallySelected(selection: Selection, employee: Employee) {
  return selection.selections.some(s => s.employeeId === employee.id
    && s.branchId === employee.branchId && s.linkedUserId === employee.linkedUserId);
}
const suspensionKey = (id: string) => `employee_account_delegation.suspension.${id}`;
const employeeProjection = {
  id: branchEmployees.id, employeeName: branchEmployees.employeeName,
  branchId: branchEmployees.branchId, linkedUserId: branchEmployees.linkedUserId,
  status: branchEmployees.status, jobTitle: branchEmployees.jobTitle,
};

/**
 * Legacy admin/RBAC/HR writers do not share advisory locks. Table locks are
 * deliberate: they prevent grant insert phantoms, employee moves, policy changes,
 * linking races and elevation during our check+write, including writes performed
 * by the old APIs. Locks are acquired BEFORE authoritative reads, at READ COMMITTED.
 * The short transaction includes account/link/permissions/branch/sessions/audit.
 * No schema migration or advisory-lock convention in unrelated writers is needed.
 */
export async function lockDelegationState(tx: Tx) {
  await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
  await tx.execute(sql`LOCK TABLE branches, branch_employees, portal_settings,
    user_assignments, user_branch_access, user_permission_overrides,
    user_permissions, users IN SHARE ROW EXCLUSIVE MODE`);
}

async function policy(tx: Tx): Promise<EmployeeAccountPolicy> {
  const [row] = await tx.select({ value: portalSettings.value }).from(portalSettings).where(eq(portalSettings.key, POLICY_KEY));
  if (!row) return { ...DEFAULT_POLICY, permissions: [] };
  try {
    const parsed = policyInput.parse(JSON.parse(row.value));
    // Previously approved action-only ceilings must remain readable for safety
    // suspension/reduction. New policy saves and grants require view explicitly.
    return { ...parsed, permissions: validatePermissions(parsed.permissions, EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS, false) };
  } catch {
    // Corrupt configuration is never treated as permissive or silently replaced.
    throw new DelegationError(503, "INVALID_POLICY", "سياسة التفويض غير صالحة؛ يرجى مراجعة مسؤول النظام");
  }
}
async function actorState(tx: Tx, id: string, adminOnly = false, beforeGrants?: () => Promise<void>) {
  const [actor] = await tx.select(accountProjection).from(users).where(eq(users.id, id));
  if (!actor) deny("DELEGATION_FORBIDDEN", "الحساب غير موجود");
  actorMayManage(actor, adminOnly);
  await beforeGrants?.();
  const grants = await tx.select({ branchId: userBranchAccess.branchId, accessLevel: userBranchAccess.accessLevel })
    .from(userBranchAccess).where(eq(userBranchAccess.userId, id));
  return { actor, visibleGrants: grants.map(g => g.branchId).filter(id => id !== HQ_BRANCH_ID),
    grants: grants.filter(g => ["full", "limited"].includes(g.accessLevel))
    .map(g => g.branchId).filter(id => id !== HQ_BRANCH_ID) };
}
async function setting(tx: Tx, key: string, value: string) {
  await tx.insert(portalSettings).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: portalSettings.key, set: { value, updatedAt: new Date() } });
}
async function audit(tx: Tx, actor: Actor, action: string, employee: Employee | null, details: unknown, targetId?: string) {
  await tx.insert(systemAuditLogs).values({
    module: "employee_account_delegation", entityId: employee ? String(employee.id) : POLICY_KEY,
    action, userId: actor.id, branchId: employee?.branchId ?? null,
    targetId: targetId ?? null, details: JSON.stringify(details),
  });
}
async function suspensionOwned(tx: Tx, account: Actor, employee: Employee) {
  const [row] = await tx.select({ value: portalSettings.value }).from(portalSettings)
    .where(eq(portalSettings.key, suspensionKey(account.id)));
  return suspensionMatches(row?.value, account, employee);
}
function suspensionMatches(value: string | undefined, account: Actor, employee: Employee) {
  if (!value || account.isActive !== "inactive" || !account.updatedAt) return false;
  try {
    const marker = JSON.parse(value);
    // Any subsequent admin edit/freeze changes updatedAt and invalidates this
    // token. Ops cannot "adopt" an already-inactive account to manufacture it.
    return marker.employeeId === employee.id && marker.branchId === employee.branchId
      && marker.updatedAt === account.updatedAt.toISOString();
  } catch { return false; }
}
async function accountState(tx: Tx, actor: Actor, employee: Employee, approved: EmployeeAccountPolicy, adminPilot = false) {
  if (!employee.linkedUserId) return null;
  const [account] = await tx.select(accountProjection).from(users).where(eq(users.id, employee.linkedUserId));
  if (!account) deny("INVALID_LINK", "رابط حساب الموظف غير صالح");
  const access = await tx.select({ branchId: userBranchAccess.branchId }).from(userBranchAccess).where(eq(userBranchAccess.userId, account.id));
  const assignments = await tx.select({ id: userAssignments.id }).from(userAssignments).where(eq(userAssignments.userId, account.id));
  const overrides = await tx.select({ id: userPermissionOverrides.id }).from(userPermissionOverrides).where(eq(userPermissionOverrides.userId, account.id));
  const direct = await tx.select({ module: userPermissions.module, actions: userPermissions.actions }).from(userPermissions).where(eq(userPermissions.userId, account.id));
  const additions = overrides.length ? await readManagedAdditions(tx, [account.id]) : [];
  const safeAdditionIds = new Set(additions.filter(row => additionIsDelegationSafe(row, employee, approved)).map(row => row.id));
  if (adminPilot) {
    actorMayManage(actor, true);
    validateAdminCashierPermissions(direct);
  }
  targetMayManage(actor.id, account, employee.branchId, access.map(g => g.branchId), assignments.length,
    overrides.filter(row => !safeAdditionIds.has(row.id)).length, adminPilot ? [] : direct, approved);
  if (!["active", "inactive"].includes(account.isActive ?? ""))
    deny("PROTECTED_ACCOUNT", "حالة الحساب تتطلب مراجعة مسؤول النظام");
  return {
    account, permissions: direct, additions,
    canReactivate: approved.enabled
      && permissionsWithin(effectiveDelegatedPermissions(account, direct), approved.permissions)
      && (actor.role === "admin" || await suspensionOwned(tx, account, employee)),
  };
}
async function dto(tx: Tx, actor: Actor, employee: Employee, approved: EmployeeAccountPolicy, adminPilot = false): Promise<DelegatedEmployeeAccount> {
  const state = await accountState(tx, actor, employee, approved, adminPilot);
  const [branch] = await tx.select({ name: branches.name }).from(branches).where(eq(branches.id, employee.branchId));
  return {
    employeeId: employee.id, employeeName: employee.employeeName,
    branchId: employee.branchId, branchName: branch?.name ?? employee.branchId,
    hasAccount: Boolean(employee.linkedUserId), management: { allowed: true, reason: "allowed" },
    account: state ? {
      id: state.account.id, username: state.account.username,
      isActive: state.account.isActive as "active" | "inactive",
      permissions: state.permissions, canReactivate: state.canReactivate,
    } : null,
  };
}
async function replacePermissions(tx: Tx, id: string, selected: DelegatedPermission[]) {
  // Delegated replacement has the same explicit-empty semantics as an admin
  // replacement; persist it within the existing account-write transaction.
  await tx.insert(userPermissionSourceModes).values({ userId: id, sourceMode: "direct" })
    .onConflictDoUpdate({
      target: userPermissionSourceModes.userId,
      set: { sourceMode: "direct", updatedAt: new Date() },
    });
  await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
  if (selected.length) await tx.insert(userPermissions).values(selected.map(p => ({ userId: id, ...p })));
}
function enforceIntrinsicSelection(jobTitle: string | null, selected: DelegatedPermission[]) {
  if (jobTitle === "delivery" && !permissionsWithin([{ module: "delivery_tasks", actions: ["view", "edit"] }], selected))
    deny("INTRINSIC_AUTHORITY", "وظيفة التوصيل تتطلب عرض وتعديل مهام التوصيل؛ لإزالتها راجع مسؤول النظام");
}
function employeeId(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new DelegationError(400, "INVALID_EMPLOYEE", "معرف الموظف غير صالح");
  return Number(value);
}

async function requireTemplateStorage(tx: Tx) {
  const result = await tx.execute(sql`SELECT
    to_regclass('public.employee_job_template_assignments') IS NOT NULL
    AND to_regclass('public.job_permission_template_drafts') IS NOT NULL
    AND to_regclass('public.job_permission_template_draft_versions') IS NOT NULL
    AND to_regclass('public.job_permission_template_approvals') IS NOT NULL
    AND to_regclass('public.user_permission_source_modes') IS NOT NULL AS ready`);
  if (!(result.rows[0] as any)?.ready)
    throw new DelegationError(503, "migration_required", "يلزم ترحيل القوالب وإسنادها 051–053 قبل استخدام هذه الخدمة");
}
async function templateEmployeeState(tx: Tx, actor: Actor, grants: string[], approved: EmployeeAccountPolicy, id: number) {
  const [employee] = await tx.select(employeeProjection).from(branchEmployees).where(eq(branchEmployees.id, id));
  if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
  branchMayManage(actor, employee.branchId, grants);
  if (employee.status !== "active") deny("EMPLOYEE_INACTIVE", "يلزم موظف مسجل ونشط في الفرع");
  if (actor.role !== "admin" && !individuallySelected(await managerSelection(tx, actor.id), employee))
    deny("EMPLOYEE_NOT_SELECTED", "لم يعتمد مسؤول النظام إدارة هذا الموظف لهذا المدير");
  const state = await accountState(tx, actor, employee, approved);
  return { employee, state };
}
async function effectiveAccountBase(tx: Tx, state: Awaited<ReturnType<typeof accountState>>) {
  const [source] = state ? await tx.select({ mode: userPermissionSourceModes.sourceMode })
    .from(userPermissionSourceModes).where(eq(userPermissionSourceModes.userId, state.account.id)) : [];
  const currentByModule = new Map<string, string[]>();
  // Eligible targets cannot have role assignments or overrides. Explicit
  // inheritance therefore grants no base actions, even if dormant direct rows
  // exist. Viewer action restrictions and intrinsic delivery remain applicable.
  const direct = source?.mode === "inherit" ? [] : state?.permissions ?? [];
  const effective = state ? effectiveDelegatedPermissions(state.account, direct) : [];
  for (const p of effective) {
    const actions = currentByModule.get(p.module) ?? [];
    for (const action of p.actions) {
      if (state?.account.role === "viewer" && action !== "view") continue;
      if (!actions.includes(action)) actions.push(action);
    }
    if (actions.length) currentByModule.set(p.module, actions);
  }
  const permissions = validatePermissions(Array.from(currentByModule, ([module, actions]) => ({ module, actions })),
    EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS, false);
  return { sourceMode: source?.mode ?? null, permissions };
}
async function readTemplateBinding(tx: Tx, employeeId: number) {
  const result = await tx.execute(sql`SELECT template_id AS "templateId", version,
    branch_id AS "branchId", revision::text, assigned_at AS "assignedAt",
    assigned_by AS "assignedBy", reason, user_id AS "userId"
    FROM public.employee_job_template_assignments WHERE employee_id = ${employeeId}`);
  const stored = result.rows[0] as any;
  const assignment: EmployeeTemplateAssignment | null = stored ? {
    templateId: stored.templateId, version: stored.version, branchId: stored.branchId,
    revision: stored.revision, assignedAt: new Date(stored.assignedAt).toISOString(),
    assignedBy: stored.assignedBy, reason: stored.reason,
  } : null;
  return { assignment, assignmentUserId: stored?.userId ?? null };
}
async function templateAssignmentSnapshot(tx: Tx, employee: Employee, state: Awaited<ReturnType<typeof accountState>>): Promise<EmployeeTemplateAssignmentResponse> {
  const { assignment, assignmentUserId } = await readTemplateBinding(tx, employee.id);
  const { sourceMode, permissions: currentPermissions } = await effectiveAccountBase(tx, state);
  // Keep the actual direct rows in the hash too (intrinsic grants may duplicate
  // them). A legacy permissions writer invalidates this token without having to
  // participate in the metadata protocol.
  const expectedAssignmentRevision = assignmentSnapshotRevision({
    employee, account: state?.account ?? null, sourceMode,
    assignment, assignmentUserId,
    direct: state?.permissions.map(p => ({ module: p.module, actions: [...p.actions].sort() }))
      .sort((a,b) => a.module.localeCompare(b.module)) ?? [],
    additions: state?.additions ?? [],
  }, currentPermissions);
  return { employeeId: employee.id, branchId: employee.branchId, assignment, currentPermissions,
    expectedAssignmentRevision, additions: (state?.additions ?? []).map(additionDTO) };
}
async function resolveAssignmentTemplate(tx: Tx, templateId: number, version: number, approved: EmployeeAccountPolicy, jobTitle: string | null, role: string, lock = true, adminPilot = false) {
  // Shared with append/approval writers and their DB triggers. Hold parent row
  // until permission replacement, session revocation and audit have committed.
  const parent = await tx.execute(sql`SELECT id FROM public.job_permission_template_drafts WHERE id = ${templateId} ${lock ? sql`FOR UPDATE` : sql``}`);
  if (!parent.rows.length) throw new DelegationError(404, "TEMPLATE_NOT_FOUND", "القالب غير موجود");
  const result = await tx.execute(sql`SELECT v.version, v.content,
    EXISTS (SELECT 1 FROM public.job_permission_template_approvals a
      WHERE a.template_id = v.template_id AND a.version = v.version) AS approved
    FROM public.job_permission_template_draft_versions v WHERE v.template_id = ${templateId}
    ORDER BY v.version DESC LIMIT 1`);
  const latest = result.rows[0] as any;
  if (latest?.version !== version)
    throw new DelegationError(409, "STALE_TEMPLATE_VERSION", "تغير آخر إصدار للقالب؛ حدّث القائمة وراجع الفروقات");
  if (!latest.approved)
    throw new DelegationError(409, "TEMPLATE_NOT_APPROVED", "آخر إصدار للقالب غير معتمد");
  return (adminPilot ? eligibleAdminTemplatePermissions(latest.content, jobTitle, role)
    : eligibleTemplatePermissions(latest.content, approved, jobTitle, role)).permissions;
}
async function saveTemplateAssignment(tx: Tx, actor: Actor, employee: Employee, input: z.infer<typeof templateAssignmentInput>) {
  const assignment: EmployeeTemplateAssignment = {
    templateId: input.templateId, version: input.version, branchId: employee.branchId,
    revision: randomUUID(), assignedAt: new Date().toISOString(), assignedBy: actor.id, reason: input.reason,
  };
  await tx.execute(sql`INSERT INTO public.employee_job_template_assignments
    (employee_id,user_id,template_id,version,branch_id,revision,assigned_at,assigned_by,reason)
    VALUES (${employee.id},${employee.linkedUserId},${input.templateId},${input.version},
      ${employee.branchId},${assignment.revision}::uuid,${assignment.assignedAt}::timestamptz,${actor.id},${input.reason})
    ON CONFLICT (employee_id) DO UPDATE SET user_id = EXCLUDED.user_id,
      template_id = EXCLUDED.template_id, version = EXCLUDED.version, branch_id = EXCLUDED.branch_id,
      revision = EXCLUDED.revision, assigned_at = EXCLUDED.assigned_at,
      assigned_by = EXCLUDED.assigned_by, reason = EXCLUDED.reason`);
  return assignment;
}
/** Shared phase-4 write primitive; caller holds guards and all state locks. */
async function applyTemplateBase(
  tx: Tx, actor: Actor, employee: Employee, state: NonNullable<Awaited<ReturnType<typeof accountState>>>,
  selected: DelegatedPermission[], input: z.infer<typeof templateAssignmentInput>, previous: EmployeeTemplateAssignment | null,
) {
  await storage.invalidateAllUserSessions(state.account.id, tx);
  await replacePermissions(tx, state.account.id, selected);
  await audit(tx, actor, "permissions_update", employee, { before: state.permissions, after: selected }, state.account.id);
  const assignment = await saveTemplateAssignment(tx, actor, employee, input);
  await audit(tx, actor, "template_assignment_update", employee, {
    reason: input.reason, before: previous, after: assignment,
    permissionsBefore: state.permissions, permissionsAfter: selected,
  }, state.account.id);
  return assignment;
}
async function pilotComparison(
  tx: Tx, actorId: string, id: number, input: { templateId: number; version: number }, applying: boolean,
) {
  const { actor } = await actorState(tx, actorId, true);
  await requireTemplateStorage(tx);
  const approved = await policy(tx);
  const [employee] = await tx.select(employeeProjection).from(branchEmployees).where(eq(branchEmployees.id, id));
  if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
  const blockedReasons: EmployeeTemplatePilotResponse["blockedReasons"] = [];
  const guard = async (work: () => any) => {
    try { return await work(); } catch (error) {
      if (!(error instanceof DelegationError)) throw error;
      blockedReasons.push({ code: error.code, message: error.message });
      return null;
    }
  };
  await guard(() => branchMayManage(actor, employee.branchId, []));
  if (employee.status !== "active") blockedReasons.push({ code: "EMPLOYEE_INACTIVE", message: "الموظف غير نشط" });
  const [account] = employee.linkedUserId
    ? await tx.select(accountProjection).from(users).where(eq(users.id, employee.linkedUserId)) : [];
  if (!account) blockedReasons.push({ code: "ACCOUNT_NOT_LINKED", message: "التجربة لحساب قائم مرتبط فقط" });
  if (account && account.isActive !== "active") blockedReasons.push({ code: "ACCOUNT_INACTIVE", message: "الحساب غير نشط؛ التجربة لا تعيد تفعيله" });
  const state = account ? await guard(() => accountState(tx, actor, employee, approved, true)) : null;
  const access = account ? await tx.select().from(userBranchAccess).where(eq(userBranchAccess.userId, account.id)) : [];
  const snapshot = account ? await storage.getPermissionDecisionSnapshot(account.id, tx) : null;
  const selected = await guard(() => resolveAssignmentTemplate(tx, input.templateId, input.version, approved,
    account?.jobTitle ?? null, account?.role ?? "employee", applying, true));
  const template = await tx.execute(sql`SELECT v.version, v.content, a.approved_at AS "approvedAt",
    a.approved_by AS "approvedBy" FROM public.job_permission_template_draft_versions v
    LEFT JOIN public.job_permission_template_approvals a ON a.template_id=v.template_id AND a.version=v.version
    WHERE v.template_id=${input.templateId} ORDER BY v.version DESC LIMIT 1`);
  const binding = await readTemplateBinding(tx, employee.id);
  if (binding.assignment && (binding.assignmentUserId !== account?.id || binding.assignment.branchId !== employee.branchId))
    blockedReasons.push({ code: "STALE_TEMPLATE_BINDING", message: "ارتباط القالب السابق لا يطابق الحساب أو فرع الموظف" });
  const linkedEmployees = account ? await tx.select({ id: branchEmployees.id }).from(branchEmployees)
    .where(eq(branchEmployees.linkedUserId, account.id)) : [];
  if (linkedEmployees.length > 1)
    blockedReasons.push({ code: "AMBIGUOUS_ACCOUNT_LINK", message: "الحساب مرتبط بأكثر من موظف؛ يلزم مراجعة الربط خارج التجربة" });
  const extras = account ? await readManagedAdditions(tx, [account.id]) : [];
  // System bypass roles cannot be represented by the non-admin permission gate.
  // Other role-auto policies can be inspected using the runtime predicate, but
  // remain protected from this bounded employee/viewer pilot application.
  const knownRole = account && [
    "employee", "viewer", "hr_manager", "hr_specialist", "financial_manager",
    "production_development_manager", "operations_manager", "branch_manager",
    "warehouse_keeper", "attendance_clerk",
  ].includes(account.role);
  const authority = (decision: PermissionDecisionSnapshot) => {
    const authPermissions = permissionGroups(evaluatePermissionDecision(decision).filter(p => p.allowed));
    const req = { currentUser: account, userBranchAccess: access, authPermissions,
      method: "GET", permissionActionInferred: false };
    return pilotAuthority(decision, employee.branchId,
      (module, action) => account!.isActive === "active"
        && contextualActionAllowed(req, decision, module, action, { branchId: employee.branchId }),
      (module, action) => intrinsicPermissionGranted(account, decision, module, action, "GET"));
  };
  const before = snapshot && knownRole ? authority(snapshot) : null;
  const canApply = Boolean(account && state && selected && !blockedReasons.length);
  const afterSnapshot = canApply ? predictTemplateSnapshot(snapshot!, selected!) : null;
  const after = afterSnapshot ? authority(afterSnapshot) : null;
  const baseSnapshot = snapshot ? { ...snapshot,
    tuples: snapshot.tuples.filter(t => t.source === "direct" || t.source === "role") } : null;
  // BASE excludes independent overlays AND intrinsic role/job authority. Keep
  // the actual runtime gate, but require an actual base tuple for each action.
  const base = baseSnapshot && knownRole ? permissionGroups(authority(baseSnapshot).effectivePermissions.flatMap(p =>
    p.actions.filter(action => checkPermissionDecision(baseSnapshot, p.module, action, { branchId: employee.branchId }))
      .map(action => ({ module: p.module, action })))) : [];
  const response: EmployeeTemplatePilotResponse = {
    employeeId: employee.id, branchId: employee.branchId, ...input,
    comparisonStatus: canApply ? "known" : "unknown", canApply, blockedReasons,
    expectedComparisonRevision: "", capturedAt: new Date(snapshot?.capturedAt ?? Date.now()).toISOString(),
    nextDecisionBoundary: snapshot ? nextDecisionBoundary(snapshot) : null,
    scope: { kind: "employee_branch", branchId: employee.branchId, limitations: [
      "هذه مقارنة بوابة الصلاحية في فرع الموظف، وليست صلاحية عامة لكل الفروع",
      "ملكية المهام والملفات وحالات سير العمل وضوابط المسارات الأخرى ما زالت مطلوبة",
      "لا إثبات لتقييد الفرع في المسارات القديمة التي لم تعتمد سياق المورد",
      "الأدوار الإدارية وإسنادات RBAC والاستثناءات غير الآمنة لا تُرحّل بهذه التجربة",
    ] },
    currentBase: base, proposedBase: selected, before, after,
    differences: before && after ? authorityDifferences(before, after) : null,
    extras: extras.map(additionDTO), assignment: binding.assignment,
  };
  // Wall clock alone must not invalidate a confirmation. All actual decision
  // and source temporal states are hashed, so crossing a boundary does.
  response.expectedComparisonRevision = createHash("sha256").update(JSON.stringify({
    employee, account, access, linkedEmployees, approved, template: template.rows, binding, extras,
    snapshot: snapshot ? { ...snapshot, capturedAt: undefined } : null,
    before, after, blockedReasons, selected,
  })).digest("hex");
  return { response, actor, employee, state, selected };
}
async function adminAdditionEmployee(tx: Tx, actorId: string, id: number) {
  const { actor } = await actorState(tx, actorId, true);
  const [employee] = await tx.select(employeeProjection).from(branchEmployees).where(eq(branchEmployees.id, id));
  if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
  if (!employee.linkedUserId) throw new DelegationError(404, "ACCOUNT_NOT_LINKED", "الموظف غير مرتبط بحساب");
  const [account] = await tx.select(accountProjection).from(users).where(eq(users.id, employee.linkedUserId));
  if (!account) throw new DelegationError(404, "ACCOUNT_NOT_LINKED", "رابط حساب الموظف غير صالح");
  return { actor, employee, account };
}
function additionId(value: string) {
  const id = employeeId(value);
  if (id > 2147483647) throw new DelegationError(400, "INVALID_INPUT", "معرف الإضافة غير صالح");
  return id;
}
const endpoint = (work: RequestHandler, operation = "account_write"): RequestHandler => async (req, res, next) => {
  const started = performance.now();
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  try { await work(req, res, next); } catch (error: any) {
    if (error instanceof DelegationError) return res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof ZodError) return res.status(400).json({ error: "بيانات الطلب غير صالحة؛ الحقول الإضافية غير مسموحة", code: "INVALID_INPUT" });
    // SQL errors can contain the bound hashed password or account identifiers.
    // Never serialize/log the error object, request body, or generated response.
    const rawCode = error?.code ?? error?.cause?.code;
    const sqlstate = typeof rawCode === "string" && /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : null;
    console.error(JSON.stringify({ operation, sqlstate, elapsedMs: Math.round(performance.now() - started) }));
    if (sqlstate === "57014")
      return res.status(503).json({ error: "انتهت مهلة قراءة البيانات؛ حاول مجدداً", code: "ACCOUNT_OPERATION_TIMEOUT" });
    if (["23505", "40001", "40P01", "55P03"].includes(error?.code ?? error?.cause?.code))
      return res.status(409).json({ error: "تغيرت البيانات أو أنشئ الحساب بالفعل؛ حدّث القائمة وحاول مجدداً", code: "CONCURRENT_CHANGE" });
    return res.status(500).json({ error: "تعذر إتمام عملية الحساب بأمان؛ لم يتم اعتماد التغيير", code: "ACCOUNT_OPERATION_FAILED" });
  }
};

/** One scoped snapshot, fixed batch count regardless of employee count. The same
 * protected-target predicate is evaluated against the manager, never the admin
 * editing that manager's selections. Internal links are not part of either DTO.
 */
async function roster(
  tx: Tx, actor: Actor, visibleGrants: string[], grants: string[],
  approved: EmployeeAccountPolicy, selection: Selection, budget: () => Promise<void>,
) {
  await budget();
  const visibleBranches = await tx.select({ id: branches.id, name: branches.name }).from(branches)
    .where(and(ne(branches.id, HQ_BRANCH_ID),
      actor.role === "admin" ? undefined : visibleGrants.length ? inArray(branches.id, visibleGrants) : sql`false`))
    .orderBy(branches.name, branches.id);
  const scope = and(eq(branchEmployees.status, "active"), ne(branchEmployees.branchId, HQ_BRANCH_ID),
    visibleBranches.length ? inArray(branchEmployees.branchId, visibleBranches.map(b => b.id)) : sql`false`);
  const linked = tx.select({ id: branchEmployees.linkedUserId }).from(branchEmployees).where(scope);
  await budget();
  const employees = await tx.select({ ...employeeProjection, branchName: branches.name })
    .from(branchEmployees).innerJoin(branches, eq(branches.id, branchEmployees.branchId))
    .where(scope).orderBy(branchEmployees.employeeName, branchEmployees.id);
  await budget();
  const accounts = await tx.select(accountProjection).from(users).where(inArray(users.id, linked));
  await budget();
  const access = await tx.select({ userId: userBranchAccess.userId, branchId: userBranchAccess.branchId })
    .from(userBranchAccess).where(inArray(userBranchAccess.userId, linked));
  await budget();
  const assignments = await tx.selectDistinct({ userId: userAssignments.userId }).from(userAssignments)
    .where(inArray(userAssignments.userId, linked));
  await budget();
  const overrides = await tx.select({ id: userPermissionOverrides.id, userId: userPermissionOverrides.userId }).from(userPermissionOverrides)
    .where(inArray(userPermissionOverrides.userId, linked));
  await budget();
  const managedAdditions = overrides.length ? await readManagedAdditions(tx, Array.from(new Set(overrides.map(o => o.userId)))) : [];
  await budget();
  const direct = await tx.select({ userId: userPermissions.userId, module: userPermissions.module, actions: userPermissions.actions })
    .from(userPermissions).where(inArray(userPermissions.userId, linked));
  await budget();
  const markers = await tx.select({ key: portalSettings.key, value: portalSettings.value }).from(portalSettings)
    .where(inArray(portalSettings.key, tx.select({ key: sql<string>`'employee_account_delegation.suspension.' || ${branchEmployees.linkedUserId}` })
      .from(branchEmployees).where(scope)));
  const byAccount = new Map(accounts.map(a => [a.id, a]));
  const assigned = new Set(assignments.map(a => a.userId));
  const markerValues = new Map(markers.map(m => [m.key, m.value]));
  const additionsByUser = new Map<string, AdditionRecord[]>();
  for (const row of managedAdditions) {
    const list = additionsByUser.get(row.overrideUserId) ?? [];
    list.push(row); additionsByUser.set(row.overrideUserId, list);
  }
  const overridesByUser = new Map<string, number[]>();
  for (const row of overrides) {
    const list = overridesByUser.get(row.userId) ?? [];
    list.push(row.id); overridesByUser.set(row.userId, list);
  }
  const grantsByUser = new Map<string, string[]>();
  for (const g of access) {
    const list = grantsByUser.get(g.userId) ?? [];
    list.push(g.branchId); grantsByUser.set(g.userId, list);
  }
  const permissionsByUser = new Map<string, DelegatedPermission[]>();
  for (const p of direct) {
    const list = permissionsByUser.get(p.userId) ?? [];
    list.push({ module: p.module, actions: p.actions }); permissionsByUser.set(p.userId, list);
  }
  const rows: DelegatedEmployeeAccount[] = [];
  for (const employee of employees) {
    let account: DelegatedEmployeeAccount["account"] = null;
    let protectedAccount = false;
    try {
      if (employee.linkedUserId) {
        const target = byAccount.get(employee.linkedUserId);
        if (!target) deny("INVALID_LINK", "رابط حساب الموظف غير صالح");
        const permissions = permissionsByUser.get(target.id) ?? [];
        const safeAdditionIds = new Set((additionsByUser.get(target.id) ?? []).filter(row => additionIsDelegationSafe(row, employee, approved)).map(row => row.id));
        const unknownOverrides = (overridesByUser.get(target.id) ?? []).filter(id => !safeAdditionIds.has(id)).length;
        targetMayManage(actor.id, target, employee.branchId, grantsByUser.get(target.id) ?? [],
          Number(assigned.has(target.id)), unknownOverrides, permissions, approved);
        if (!["active", "inactive"].includes(target.isActive ?? ""))
          deny("PROTECTED_ACCOUNT", "حالة الحساب تتطلب مراجعة مسؤول النظام");
        account = { id: target.id, username: target.username, isActive: target.isActive as "active" | "inactive",
          permissions, canReactivate: approved.enabled
            && permissionsWithin(effectiveDelegatedPermissions(target, permissions), approved.permissions)
            && (actor.role === "admin" || suspensionMatches(markerValues.get(suspensionKey(target.id)), target, employee)) };
      }
    } catch (error) {
      if (!(error instanceof DelegationError) || error.status !== 403) throw error;
      protectedAccount = true;
    }
    const reason: DelegatedEmployeeAccount["management"]["reason"] = protectedAccount ? "protected_account"
      : actor.role !== "admin" && !grants.includes(employee.branchId) ? "read_only_branch"
      : actor.role !== "admin" && !individuallySelected(selection, employee) ? "not_selected" : "allowed";
    rows.push({
      employeeId: employee.id, employeeName: employee.employeeName, branchId: employee.branchId,
      branchName: employee.branchName, hasAccount: Boolean(employee.linkedUserId),
      management: { allowed: reason === "allowed", reason }, account: reason === "allowed" ? account : null,
    });
  }
  await budget();
  return { branches: visibleBranches, employees: rows, internalEmployees: employees };
}

function readBudget(deadline: number, tx: Tx) {
  return async () => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw Object.assign(new Error("Directory deadline"), { code: "57014" });
    await tx.execute(sql`SELECT set_config('statement_timeout', ${String(remaining)}, true),
      set_config('idle_in_transaction_session_timeout', '10000', true)`);
  };
}

async function managerDetail(tx: Tx, managerId: string, budget: () => Promise<void>) {
  await budget();
  const [manager] = await tx.select(accountProjection).from(users).where(eq(users.id, managerId));
  if (!manager) throw new DelegationError(404, "MANAGER_NOT_FOUND", "مدير التشغيل غير موجود");
  await budget();
  const selected = await managerSelection(tx, managerId);
  const revision = (scope: unknown) => createHash("sha256")
    .update(JSON.stringify({ stored: selected, manager, scope })).digest("hex");
  // Former/inactive managers can still have outdated grants cleared, but no
  // out-of-scope employee identifiers are returned or accepted for new grants.
  if (manager.role !== "operations_manager" || manager.isActive !== "active") {
    return { response: { managerId, revision: revision([]), employees: [], selectedEmployeeIds: [] } as EmployeeAccountManagerSelectionResponse,
      selected, internalEmployees: [] as Employee[] };
  }
  const state = await actorState(tx, managerId, false, budget);
  await budget();
  const approved = await policy(tx);
  const data = await roster(tx, manager, state.visibleGrants, state.grants, approved, selected, budget);
  const employees: EmployeeAccountManagerSelectionResponse["employees"] = data.employees.map(e => ({
    employeeId: e.employeeId, employeeName: e.employeeName, branchId: e.branchId, branchName: e.branchName,
    hasAccount: e.hasAccount, eligible: ["allowed", "not_selected"].includes(e.management.reason),
    reason: e.management.reason === "not_selected" ? "allowed" : e.management.reason,
  }));
  const eligible = new Set(employees.filter(e => e.eligible).map(e => e.employeeId));
  return { response: {
    managerId, revision: revision({ branches: data.branches, grants: Array.from(new Set(state.grants)).sort(),
      employees: data.internalEmployees, eligibility: employees }), employees,
    selectedEmployeeIds: data.internalEmployees.filter(e => eligible.has(e.id) && individuallySelected(selected, e)).map(e => e.id).sort((a,b) => a-b),
  } as EmployeeAccountManagerSelectionResponse, selected, internalEmployees: data.internalEmployees };
}

export function registerEmployeeAccountDelegation(app: Express) {
  // Deny all legacy reads and writes for ops, even with manually granted users,
  // RBAC or HR permissions. No body-controlled role or branch decides access.
  app.use((req, res, next) => {
    if (!isLegacyAccountPath(req.path, req.method, req.body)) return next();
    return isAuthenticated(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (req.currentUser?.role === "operations_manager")
        return res.status(403).json({ error: "استخدم إدارة حسابات الموظفين المفوضة فقط", code: "USE_EMPLOYEE_ACCOUNT_DELEGATION" });
      next();
    });
  });

  app.get("/api/operations/employee-accounts/job-templates", isAuthenticated, endpoint(async (req, res) => {
    const id = req.query.employeeId === undefined ? undefined
      : employeeId(z.string().parse(req.query.employeeId));
    const templates = await db.transaction(async tx => {
      const budget = readBudget(performance.now() + 10_000, tx);
      await budget();
      const { actor, grants } = await actorState(tx, req.session.userId!);
      await requireTemplateStorage(tx);
      const approved = await policy(tx);
      let jobTitle: string | null | undefined;
      let targetRole = "employee";
      if (id !== undefined) {
        const { employee, state } = await templateEmployeeState(tx, actor, grants, approved, id);
        jobTitle = state ? state.account.jobTitle : employee.jobTitle === "delivery" ? "delivery" : null;
        targetRole = state?.account.role ?? "employee";
      }
      const result = await tx.execute(sql`SELECT d.id AS "templateId", v.version, v.content,
        a.approved_at AS "approvedAt"
        FROM public.job_permission_template_drafts d
        JOIN public.job_permission_template_draft_versions v ON v.template_id = d.id
        JOIN public.job_permission_template_approvals a ON a.template_id = v.template_id AND a.version = v.version
        WHERE v.version = (SELECT MAX(x.version) FROM public.job_permission_template_draft_versions x WHERE x.template_id = d.id)
        ORDER BY d.id`);
      const summaries: EmployeeJobTemplateSummary[] = [];
      for (const raw of result.rows as any[]) {
        try {
          const { content, permissions } = eligibleTemplatePermissions(raw.content, approved, jobTitle, targetRole);
          summaries.push({ templateId: raw.templateId, version: raw.version, key: content.key,
            name: content.name, scopeType: content.scopeType as EmployeeJobTemplateSummary["scopeType"],
            permissions, approvedAt: new Date(raw.approvedAt).toISOString() });
        } catch (error) {
          if (!(error instanceof DelegationError)) throw error;
          // Ineligibility is a catalog filter, never a permissive write fallback.
        }
      }
      await budget();
      return summaries;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json({ templates });
  }, "employee_job_template_catalog"));

  app.get("/api/operations/employee-accounts/:employeeId/template-assignment", isAuthenticated, endpoint(async (req, res) => {
    const id = employeeId(req.params.employeeId);
    const result = await db.transaction(async tx => {
      await readBudget(performance.now() + 10_000, tx)();
      const { actor, grants } = await actorState(tx, req.session.userId!);
      await requireTemplateStorage(tx);
      const approved = await policy(tx);
      const { employee, state } = await templateEmployeeState(tx, actor, grants, approved, id);
      return templateAssignmentSnapshot(tx, employee, state);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_template_assignment_snapshot"));

  app.get("/api/admin/employee-account-additions/:employeeId", isAuthenticated, endpoint(async (req, res) => {
    const id = employeeId(req.params.employeeId);
    const result = await db.transaction(async tx => {
      await readBudget(performance.now() + 10_000, tx)();
      const { employee, account } = await adminAdditionEmployee(tx, req.session.userId!, id);
      await requireAdditionsStorage(tx);
      const records = await readManagedAdditions(tx, [account.id], true);
      return { employeeId: employee.id, branchId: employee.branchId, userId: account.id,
        additions: records.filter(row => row.employeeId === employee.id && row.userId === account.id
          && row.overrideUserId === account.id).map(additionDTO), capabilities: ADDITION_CAPABILITIES };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_account_additions_read"));

  const mutateAddition = (mode: "create" | "update" | "delete"): RequestHandler => endpoint(async (req, res) => {
    const id = employeeId(req.params.employeeId);
    const rowId = mode === "create" ? null : additionId(req.params.id);
    const input = mode === "create" ? additionInput.parse(req.body)
      : mode === "update" ? additionUpdateInput.parse(req.body) : additionDeleteInput.parse(req.body);
    const result = await db.transaction(async tx => {
      await lockDelegationState(tx);
      const { actor, employee, account } = await adminAdditionEmployee(tx, req.session.userId!, id);
      await requireAdditionsStorage(tx);
      await tx.execute(sql`LOCK TABLE public.employee_account_additions, public.permissions IN SHARE ROW EXCLUSIVE MODE`);
      const records = await readManagedAdditions(tx, [account.id], true);
      const before = rowId === null ? null : records.find(row => row.id === rowId
        && row.employeeId === employee.id && row.userId === account.id && row.overrideUserId === account.id);
      if (rowId !== null && !before)
        throw new DelegationError(404, "ADDITION_NOT_FOUND", "الإضافة غير موجودة أو لا تخص الموظف وحسابه المرتبط");
      if ("expectedRevision" in input && before!.revision !== input.expectedRevision)
        throw new DelegationError(409, "ADDITION_REVISION_CONFLICT", "تغيرت الإضافة؛ حدّث القائمة وراجع التغيير");
      if (mode === "delete") {
        await storage.invalidateAllUserSessions(account.id, tx);
        // Delete provenance first; never erase an unknown legacy override.
        await tx.execute(sql`DELETE FROM public.employee_account_additions
          WHERE override_id = ${rowId} AND employee_id = ${employee.id} AND user_id = ${account.id}`);
        await tx.delete(userPermissionOverrides).where(and(eq(userPermissionOverrides.id, rowId!),
          eq(userPermissionOverrides.userId, account.id)));
        await audit(tx, actor, "addition_delete", employee,
          { reason: input.reason, before: additionDTO(before!), beforeOverride: additionFingerprint(before!), after: null }, account.id);
        return { userId: account.id, response: { deleted: true, id: rowId } };
      }
      if (!("module" in input)) throw new DelegationError(400, "INVALID_INPUT", "بيانات الإضافة غير صالحة");
      validateAddition(input, employee.branchId);
      let [permission] = await tx.select({ id: permissionCatalog.id }).from(permissionCatalog)
        .where(and(eq(permissionCatalog.module, input.module), eq(permissionCatalog.action, input.action)))
        .orderBy(permissionCatalog.id).limit(1);
      if (!permission) {
        [permission] = await tx.insert(permissionCatalog).values({
          module: input.module, action: input.action, name: `${input.module}:${input.action}`,
        }).returning({ id: permissionCatalog.id });
      }
      const values = {
        userId: account.id, permissionId: permission.id, allow: input.allow,
        branchId: input.scopeType === "branch" ? input.branchId! : null, departmentId: null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.endsAt ? new Date(input.endsAt) : null,
        reason: input.reason, grantedBy: actor.id, updatedAt: new Date(),
      };
      await storage.invalidateAllUserSessions(account.id, tx);
      const [override] = mode === "create" ? await tx.insert(userPermissionOverrides).values(values).returning()
        : await tx.update(userPermissionOverrides).set(values)
          .where(and(eq(userPermissionOverrides.id, rowId!), eq(userPermissionOverrides.userId, account.id))).returning();
      const changedAt = new Date().toISOString();
      const record: AdditionRecord = {
        id: override.id, employeeId: employee.id, userId: account.id, employeeBranchId: employee.branchId,
        revision: randomUUID(), snapshot: null, createdBy: before?.createdBy ?? actor.id,
        createdAt: before?.createdAt ?? changedAt, updatedAt: changedAt, overrideUserId: account.id,
        permissionId: permission.id, module: input.module, action: input.action, allow: override.allow,
        branchId: override.branchId, departmentId: override.departmentId, startsAt: override.startsAt,
        endsAt: override.expiresAt, reason: override.reason, grantedBy: override.grantedBy,
        overrideCreatedAt: override.createdAt, overrideUpdatedAt: override.updatedAt,
      };
      record.snapshot = additionFingerprint(record);
      await tx.execute(sql`INSERT INTO public.employee_account_additions
        (override_id,employee_id,user_id,employee_branch_id,revision,snapshot,created_by,created_at,updated_at)
        VALUES (${record.id},${employee.id},${account.id},${employee.branchId},${record.revision}::uuid,
          ${JSON.stringify(record.snapshot)}::jsonb,${record.createdBy},${record.createdAt}::timestamptz,${record.updatedAt}::timestamptz)
        ON CONFLICT (override_id) DO UPDATE SET employee_id = EXCLUDED.employee_id,
          user_id = EXCLUDED.user_id, employee_branch_id = EXCLUDED.employee_branch_id,
          revision = EXCLUDED.revision, snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`);
      await audit(tx, actor, mode === "create" ? "addition_create" : "addition_update", employee,
        { reason: input.reason, before: before ? additionDTO(before) : null,
          beforeOverride: before ? additionFingerprint(before) : null, after: additionDTO(record) }, account.id);
      return { userId: account.id, response: { addition: additionDTO(record) } };
    });
    invalidateAuthCache(result.userId);
    res.status(mode === "create" ? 201 : 200).json(result.response);
  }, `employee_account_addition_${mode}`);
  app.post("/api/admin/employee-account-additions/:employeeId", isAuthenticated, mutateAddition("create"));
  app.patch("/api/admin/employee-account-additions/:employeeId/:id", isAuthenticated, mutateAddition("update"));
  app.delete("/api/admin/employee-account-additions/:employeeId/:id", isAuthenticated, mutateAddition("delete"));

  app.get("/api/admin/employee-template-pilot-catalog", isAuthenticated, endpoint(async (req, res) => {
    const result = await db.transaction(async tx => {
      await readBudget(performance.now() + 10_000, tx)();
      await actorState(tx, req.session.userId!, true);
      await requireTemplateStorage(tx);
      const rows = await tx.execute(sql`SELECT d.id AS "templateId", v.version,
        v.content, a.approved_at AS "approvedAt"
        FROM public.job_permission_template_drafts d
        JOIN public.job_permission_template_draft_versions v ON v.template_id=d.id
        JOIN public.job_permission_template_approvals a ON a.template_id=v.template_id AND a.version=v.version
        WHERE v.version=(SELECT MAX(x.version) FROM public.job_permission_template_draft_versions x WHERE x.template_id=d.id)
        ORDER BY d.id`);
      // Visibility is not authority: unsupported approved versions remain
      // selectable so the comparison can explain its precise blockers.
      return { templates: rows.rows.map((row: any) => ({
        templateId: row.templateId, version: row.version, key: row.content.key,
        name: row.content.name, scopeType: row.content.scopeType,
        permissions: row.content.permissions, approvedAt: new Date(row.approvedAt).toISOString(),
      })) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "admin_employee_template_catalog"));
  app.get("/api/admin/employee-template-pilot/:employeeId", isAuthenticated, endpoint(async (req, res) => {
    const input = pilotQuery.parse(req.query);
    const result = await db.transaction(async tx => {
      await readBudget(performance.now() + 10_000, tx)();
      return pilotComparison(tx, req.session.userId!, employeeId(req.params.employeeId), input, false);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result.response);
  }, "employee_template_pilot_preview"));
  app.post("/api/admin/employee-template-pilot/:employeeId", isAuthenticated, endpoint(async (req, res) => {
    const input = pilotInput.parse(req.body);
    const result = await db.transaction(async tx => {
      await lockDelegationState(tx);
      // Hold catalogue/provenance, template-parent and existing phase-4 locks
      // while recomputing the reviewed evidence and writing the one account.
      await tx.execute(sql`LOCK TABLE public.employee_job_template_assignments,
        public.user_permission_source_modes IN SHARE ROW EXCLUSIVE MODE`);
      if (await additionsStorageReady(tx))
        await tx.execute(sql`LOCK TABLE public.employee_account_additions, public.permissions IN SHARE ROW EXCLUSIVE MODE`);
      const current = await pilotComparison(tx, req.session.userId!, employeeId(req.params.employeeId),
        { templateId: input.templateId, version: input.version }, true);
      if (input.branchId !== current.employee.branchId) deny("BRANCH_FORBIDDEN", "الفرع لا يطابق فرع الموظف المسجل");
      if (current.response.expectedComparisonRevision !== input.expectedComparisonRevision)
        throw new DelegationError(409, "COMPARISON_REVISION_CONFLICT", "تغيرت المقارنة؛ أعد معاينة المصادر والفروقات");
      if (!current.response.canApply || !current.state || !current.selected)
        return { blocked: current.response, userId: null };
      const ensureBoundaryUnchanged = () => {
        if (current.response.nextDecisionBoundary && Date.now() >= Date.parse(current.response.nextDecisionBoundary))
          throw new DelegationError(409, "COMPARISON_REVISION_CONFLICT", "انتهت صلاحية المقارنة عند حد زمني؛ أعد المعاينة");
      };
      ensureBoundaryUnchanged();
      const assignmentInput = { ...input, expectedAssignmentRevision: current.response.expectedComparisonRevision };
      const assignment = await applyTemplateBase(tx, current.actor, current.employee, current.state,
        current.selected, assignmentInput, current.response.assignment);
      await audit(tx, current.actor, "pilot_apply", current.employee, {
        reason: input.reason, comparisonRevision: current.response.expectedComparisonRevision,
        scope: current.response.scope, before: current.response.before, after: current.response.after,
        differences: current.response.differences, extras: current.response.extras, assignment,
      }, current.state.account.id);
      ensureBoundaryUnchanged();
      return { userId: current.state.account.id, employee: await dto(tx, current.actor, current.employee, await policy(tx), true),
        assignment, comparison: current.response };
    });
    if (result.blocked) return res.status(403).json({ error: "الحساب أو القالب خارج التجربة المحدودة",
      code: "PILOT_BLOCKED", blockedReasons: result.blocked.blockedReasons });
    invalidateAuthCache(result.userId!);
    res.json({ employee: result.employee, assignment: result.assignment, comparison: result.comparison });
  }, "employee_template_pilot_apply"));

  app.get("/api/operations/employee-accounts", isAuthenticated, endpoint(async (req, res) => {
    const deadline = performance.now() + 10_000;
    const result = await db.transaction(async tx => {
      const budget = readBudget(deadline, tx);
      await budget();
      const { actor, grants, visibleGrants } = await actorState(tx, req.session.userId!, false, budget);
      await budget();
      const approved = await policy(tx);
      await budget();
      const selection = actor.role === "admin" ? { revision: "0", selections: [] } : await managerSelection(tx, actor.id);
      const data = await roster(tx, actor, visibleGrants, grants, approved, selection, budget);
      const available = actor.role === "admin" ? EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS : approved.permissions;
      const result: EmployeeAccountsResponse = {
        employees: data.employees, branches: data.branches, policy: approved, availablePermissions: available,
        templates: delegationTemplates(approved.enabled ? approved.permissions : []),
      };
      return result;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_account_directory"));

  app.get("/api/admin/employee-account-managers", isAuthenticated, endpoint(async (req, res) => {
    const deadline = performance.now() + 10_000;
    const result = await db.transaction(async tx => {
      const budget = readBudget(deadline, tx);
      await budget();
      await actorState(tx, req.session.userId!, true, budget);
      await budget();
      const managers = await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users).where(and(eq(users.role, "operations_manager"), eq(users.isActive, "active")))
        .orderBy(users.firstName, users.id);
      await budget();
      const grants = await tx.select({ userId: userBranchAccess.userId, id: branches.id, name: branches.name,
        accessLevel: userBranchAccess.accessLevel }).from(userBranchAccess)
        .innerJoin(branches, eq(branches.id, userBranchAccess.branchId))
        .where(and(ne(branches.id, HQ_BRANCH_ID), inArray(userBranchAccess.userId,
          tx.select({ id: users.id }).from(users).where(and(eq(users.role, "operations_manager"), eq(users.isActive, "active"))))))
        .orderBy(branches.name, branches.id);
      const byManager = new Map<string, Map<string, { id: string; name: string; canManage: boolean }>>();
      for (const grant of grants) {
        const list = byManager.get(grant.userId) ?? new Map();
        list.set(grant.id, { id: grant.id, name: grant.name,
          canManage: Boolean(list.get(grant.id)?.canManage) || ["full", "limited"].includes(grant.accessLevel) });
        byManager.set(grant.userId, list);
      }
      await budget();
      return { managers: managers.map(m => ({
        id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(" ") || "مدير تشغيل",
        branches: Array.from(byManager.get(m.id)?.values() ?? []),
      })) } satisfies EmployeeAccountManagersResponse;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_account_managers"));

  app.get("/api/admin/employee-account-managers/:managerId", isAuthenticated, endpoint(async (req, res) => {
    const deadline = performance.now() + 10_000;
    const result = await db.transaction(async tx => {
      const budget = readBudget(deadline, tx);
      await budget();
      await actorState(tx, req.session.userId!, true, budget);
      return (await managerDetail(tx, req.params.managerId, budget)).response;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_account_manager_selection"));

  app.put("/api/admin/employee-account-managers/:managerId", isAuthenticated, endpoint(async (req, res) => {
    const input = managerSelectionInput.parse(req.body);
    if (new Set(input.employeeIds).size !== input.employeeIds.length)
      throw new DelegationError(400, "DUPLICATE_EMPLOYEE", "لا تكرر اختيار الموظف");
    const result = await db.transaction(async tx => {
      await lockDelegationState(tx);
      const { actor } = await actorState(tx, req.session.userId!, true);
      const budget = readBudget(performance.now() + 10_000, tx);
      const current = await managerDetail(tx, req.params.managerId, budget);
      if (current.response.revision !== input.revision)
        throw new DelegationError(409, "SELECTION_REVISION_CONFLICT", "تغيرت اختيارات المدير؛ حدّث القائمة وحاول مجدداً");
      const eligible = new Set(current.response.employees.filter(e => e.eligible).map(e => e.employeeId));
      if (input.employeeIds.some(id => !eligible.has(id)))
        deny("EMPLOYEE_SELECTION_FORBIDDEN", "الاختيار يشمل موظفاً غير مؤهل أو خارج نطاق مدير التشغيل");
      const requested = new Set(input.employeeIds);
      const next: Selection = { revision: randomUUID(), selections: current.internalEmployees
        .filter(e => requested.has(e.id)).map(e => ({
          employeeId: e.id, branchId: e.branchId, linkedUserId: e.linkedUserId,
        })).sort((a,b) => a.employeeId-b.employeeId) };
      await setting(tx, selectionKey(req.params.managerId), JSON.stringify(next));
      // Audit only the minimal employee-ID diff; never account/credential/HR
      // payloads. Hidden stale IDs may be removed, but are not returned to UI.
      const before = new Set(current.selected.selections.map(e => e.employeeId));
      await audit(tx, actor, "manager_selection_update", null, {
        addedEmployeeIds: next.selections.filter(e => !before.has(e.employeeId)).map(e => e.employeeId),
        removedEmployeeIds: Array.from(before).filter(id => !requested.has(id)),
      }, req.params.managerId);
      return (await managerDetail(tx, req.params.managerId, budget)).response;
    });
    res.json(result);
  }, "employee_account_manager_selection_update"));

  app.put("/api/admin/employee-account-policy", isAuthenticated, endpoint(async (req, res) => {
    const input = policyInput.parse(req.body);
    const selected = validatePermissions(input.permissions);
    const approved = await db.transaction(async tx => {
      await lockDelegationState(tx);
      const { actor } = await actorState(tx, req.session.userId!, true);
      const previous = await policy(tx);
      const next = { enabled: input.enabled, permissions: selected };
      await setting(tx, POLICY_KEY, JSON.stringify(next));
      await audit(tx, actor, "policy_update", null, { before: previous, after: next });
      return next;
    });
    res.json({ policy: approved });
  }));

  const mutate = (mode: "create" | "permissions" | "status" | "template-account" | "template-assignment"): RequestHandler => endpoint(async (req, res) => {
    const id = employeeId(req.params.employeeId);
    const templateMode = mode === "template-account" || mode === "template-assignment";
    const creating = mode === "create" || mode === "template-account";
    const input = templateMode ? templateAssignmentInput.parse(req.body) : mode === "status" ? statusInput.parse(req.body)
      : mode === "create" ? createAccountInput.parse(req.body) : permissionsInput.parse(req.body);
    // Expensive CSPRNG/hash outside the lock; no credential or user is persisted
    // unless every authoritative check succeeds inside the transaction.
    const credentials = creating ? generatedCredentials() : null;
    const passwordHash = credentials ? await bcrypt.hash(credentials.password, 12) : null;
    const result = await db.transaction(async tx => {
      await lockDelegationState(tx);
      if (templateMode) {
        await requireTemplateStorage(tx);
        await tx.execute(sql`LOCK TABLE public.employee_job_template_assignments,
          public.user_permission_source_modes IN SHARE ROW EXCLUSIVE MODE`);
      }
      // Every ops override classification must remain stable through the write.
      // Unknown/privileged extras still fail targetMayManage; safe managed extras
      // are never rewritten by base operations.
      const additionReady = await tx.execute(sql`SELECT to_regclass('public.employee_account_additions') IS NOT NULL AS ready`);
      if ((additionReady.rows[0] as any)?.ready)
        await tx.execute(sql`LOCK TABLE public.employee_account_additions, public.permissions IN SHARE ROW EXCLUSIVE MODE`);
      const { actor, grants } = await actorState(tx, req.session.userId!);
      if (actor.role === "operations_manager" && mode === "create")
        deny("APPROVED_TEMPLATE_REQUIRED", "إنشاء حساب الموظف يتطلب اختيار إصدار قالب معتمد");
      let legacyReductionMetadataReady = false;
      if (actor.role === "operations_manager" && mode === "permissions") {
        await tx.execute(sql`LOCK TABLE public.user_permission_source_modes IN SHARE ROW EXCLUSIVE MODE`);
        // Safety maintenance remains available before migration 053. An absent
        // table cannot hold a binding; a present table is locked before its read.
        const ready = await tx.execute(sql`SELECT
          to_regclass('public.employee_job_template_assignments') IS NOT NULL AS ready`);
        legacyReductionMetadataReady = Boolean((ready.rows[0] as any)?.ready);
        if (legacyReductionMetadataReady)
          await tx.execute(sql`LOCK TABLE public.employee_job_template_assignments IN SHARE ROW EXCLUSIVE MODE`);
      }
      const approved = await policy(tx);
      if (!approved.enabled && (creating || templateMode || ("isActive" in input && input.isActive === "active")))
        deny("DELEGATION_DISABLED", "التفويض غير مفعّل: يمكن عرض الحسابات وتعليقها وتقليل صلاحياتها فقط");
      const [employee] = await tx.select(employeeProjection).from(branchEmployees).where(eq(branchEmployees.id, id)).for("update");
      if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
      branchMayManage(actor, employee.branchId, grants);
      if (employee.status !== "active") deny("EMPLOYEE_INACTIVE", "يلزم موظف مسجل ونشط في الفرع");
      const state = await accountState(tx, actor, employee, approved);
      const individualGrant: Selection = actor.role === "admin"
        ? { revision: "0", selections: [] } : await managerSelection(tx, actor.id);
      if (actor.role !== "admin" && !individuallySelected(individualGrant, employee))
        deny("EMPLOYEE_NOT_SELECTED", "لم يعتمد مسؤول النظام إدارة هذا الموظف لهذا المدير");
      let previousAssignment: EmployeeTemplateAssignment | null = null;
      let assigned: EmployeeTemplateAssignment | null = null;
      let selected = "permissions" in input ? validatePermissions(input.permissions, approved.permissions) : null;
      if ("templateId" in input) {
        if (input.branchId !== employee.branchId) deny("BRANCH_FORBIDDEN", "الفرع المختار لا يطابق فرع الموظف المسجل");
        const snapshot = await templateAssignmentSnapshot(tx, employee, state);
        if (snapshot.expectedAssignmentRevision !== input.expectedAssignmentRevision)
          throw new DelegationError(409, "ASSIGNMENT_REVISION_CONFLICT", "تغير الحساب أو إسناده؛ حدّث المعاينة وراجع الفروقات");
        previousAssignment = snapshot.assignment;
        selected = await resolveAssignmentTemplate(tx, input.templateId, input.version, approved,
          state ? state.account.jobTitle : employee.jobTitle === "delivery" ? "delivery" : null,
          state?.account.role ?? "employee");
      }
      if (creating) {
        if (state) throw new DelegationError(409, "ACCOUNT_ALREADY_LINKED", "الموظف مرتبط بحساب بالفعل");
        // Descriptive HR titles never become admin/RBAC roles. The sole
        // title-dependent auth behavior (delivery) is explicitly ceiling-checked.
        const jobTitle = employee.jobTitle === "delivery" ? "delivery" : null;
        enforceIntrinsicSelection(jobTitle, selected!);
        credentials!.username = await availableGeneratedUsername(credentials!.username, async username => {
          const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
          return Boolean(existing);
        });
        const [account] = await tx.insert(users).values({
          username: credentials!.username, password: passwordHash!,
          firstName: employee.employeeName, lastName: null, role: "employee",
          branchId: employee.branchId, jobTitle, isActive: "active",
        }).returning();
        await tx.insert(userBranchAccess).values({ userId: account.id, branchId: employee.branchId, accessLevel: "limited", isDefault: true });
        await replacePermissions(tx, account.id, selected!);
        await tx.update(branchEmployees).set({ linkedUserId: account.id, updatedAt: new Date() })
          .where(and(eq(branchEmployees.id, employee.id), sql`${branchEmployees.linkedUserId} IS NULL`));
        employee.linkedUserId = account.id;
        if (actor.role !== "admin") {
          // Bind the approved unlinked target to this atomically created account.
          // A later legacy relink/transfer cannot carry authority to a new target.
          individualGrant.revision = randomUUID();
          for (const s of individualGrant.selections)
            if (s.employeeId === employee.id) s.linkedUserId = account.id;
          await setting(tx, selectionKey(actor.id), JSON.stringify(individualGrant));
        }
        await audit(tx, actor, "account_create", employee, { permissions: selected, role: "employee" }, account.id);
      } else {
        if (!state) throw new DelegationError(409, "ACCOUNT_NOT_LINKED", "لا يوجد حساب مرتبط بالموظف");
        const account = state.account;
        if (mode === "permissions" || mode === "template-assignment") {
          enforceIntrinsicSelection(account.jobTitle, selected!);
          let removedTemplateBinding: EmployeeTemplateAssignment | null = null;
          if (actor.role === "operations_manager" && mode === "permissions") {
            const { permissions: effectiveBase } = await effectiveAccountBase(tx, state);
            if (!permissionsWithin(selected!, effectiveBase))
              deny("REDUCTION_ONLY", "إضافة الصلاحيات أو تبديلها يتطلب إصدار قالب معتمد؛ المسار القديم لخفض الصلاحيات فقط");
            const actualReduction = !permissionsWithin(effectiveBase, selected!);
            if (actualReduction && legacyReductionMetadataReady) {
              removedTemplateBinding = (await templateAssignmentSnapshot(tx, employee, state)).assignment;
              if (removedTemplateBinding)
                await tx.execute(sql`DELETE FROM public.employee_job_template_assignments WHERE employee_id = ${employee.id}`);
            }
          }
          const existingEffective = effectiveDelegatedPermissions(account, state.permissions);
          // Disabled policies and accounts outside a narrowed approval may only
          // lose permissions, never exchange them for new rights. The requested
          // result was already validated against the current approved ceiling.
          if ((!approved.enabled || !permissionsWithin(existingEffective, approved.permissions))
              && !permissionsWithin(selected!, existingEffective))
            deny("REDUCTION_ONLY", "بعد سحب التفويض يسمح بتقليل الصلاحيات الحالية إلى الحدود المعتمدة فقط");
          if (mode === "template-assignment" && "templateId" in input) {
            assigned = await applyTemplateBase(tx, actor, employee, state, selected!, input, previousAssignment);
          } else {
            await storage.invalidateAllUserSessions(account.id, tx);
            await replacePermissions(tx, account.id, selected!);
            await audit(tx, actor, "permissions_update", employee, {
              before: state.permissions, after: selected,
              ...(actor.role === "operations_manager" && mode === "permissions" ? {
                reason: "خفض صلاحيات عبر مسار الصيانة القديم",
                removedTemplateBinding,
              } : {}),
            }, account.id);
          }
        } else if ("isActive" in input) {
          if (input.isActive === "active"
              && !permissionsWithin(effectiveDelegatedPermissions(account, state.permissions), approved.permissions))
            deny("PERMISSION_NOT_APPROVED", "قلّل صلاحيات الحساب إلى الحدود المعتمدة قبل إعادة تفعيله");
          if (input.isActive === "active" && account.isActive === "inactive" && !state.canReactivate)
            deny("ADMIN_FROZEN_ACCOUNT", "الحساب مجمّد خارج تفويض التشغيل؛ يلزم مسؤول النظام لإعادة تفعيله");
          if (input.isActive !== account.isActive) {
            // Invalidation MUST run in the same transaction and before making
            // the user active. Failure rolls back the entire lifecycle change.
            await storage.invalidateAllUserSessions(account.id, tx);
            const changedAt = new Date();
            await tx.update(users).set({ isActive: input.isActive, updatedAt: changedAt }).where(eq(users.id, account.id));
            if (input.isActive === "inactive" && actor.role === "operations_manager")
              await setting(tx, suspensionKey(account.id), JSON.stringify({ employeeId: employee.id, branchId: employee.branchId, updatedAt: changedAt.toISOString() }));
            else await tx.delete(portalSettings).where(eq(portalSettings.key, suspensionKey(account.id)));
            await audit(tx, actor, "account_status_update", employee, { before: account.isActive, after: input.isActive }, account.id);
          } else if (actor.role === "admin" && input.isActive === "inactive") {
            // An explicit admin freeze of an already ops-suspended account
            // revokes the ops reactivation token too.
            await storage.invalidateAllUserSessions(account.id, tx);
            await tx.delete(portalSettings).where(eq(portalSettings.key, suspensionKey(account.id)));
            await audit(tx, actor, "account_admin_freeze", employee, { isActive: "inactive" }, account.id);
          }
        }
      }
      if ("templateId" in input && !assigned) {
        assigned = await saveTemplateAssignment(tx, actor, employee, input);
        await audit(tx, actor, creating ? "template_account_create" : "template_assignment_update", employee, {
          reason: input.reason, before: previousAssignment, after: assigned,
          permissionsBefore: state?.permissions ?? [], permissionsAfter: selected,
        }, employee.linkedUserId!);
      }
      return { employee: await dto(tx, actor, employee, approved), assignment: assigned };
    });
    if (result.employee.account) invalidateAuthCache(result.employee.account.id);
    res.status(creating ? 201 : 200).json({ employee: result.employee,
      ...(templateMode ? { assignment: result.assignment } : {}), ...(credentials ? { credentials } : {}) });
  });
  app.post("/api/operations/employee-accounts/:employeeId/template-account", isAuthenticated, mutate("template-account"));
  app.post("/api/operations/employee-accounts/:employeeId/template-assignment", isAuthenticated, mutate("template-assignment"));
  app.post("/api/operations/employee-accounts/:employeeId", isAuthenticated, mutate("create"));
  app.put("/api/operations/employee-accounts/:employeeId/permissions", isAuthenticated, mutate("permissions"));
  app.patch("/api/operations/employee-accounts/:employeeId/status", isAuthenticated, mutate("status"));
}