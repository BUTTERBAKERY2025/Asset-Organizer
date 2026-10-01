import type { Express, RequestHandler } from "express";
import bcrypt from "bcrypt";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  branchEmployees, branches, users, userBranchAccess, userPermissions,
  userAssignments, userPermissionOverrides, portalSettings, systemAuditLogs,
} from "@shared/schema";
import {
  EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS, type DelegatedEmployeeAccount,
  type DelegatedPermission, type EmployeeAccountPolicy, type EmployeeAccountsResponse,
} from "@shared/employee-account-delegation";
import { HQ_BRANCH_ID } from "@shared/employee-organization";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, invalidateAuthCache } from "./auth";
import {
  actorMayManage, branchMayManage, DEFAULT_POLICY, DelegationError, deny,
  delegationTemplates, effectiveDelegatedPermissions, generatedCredentials, isLegacyAccountPath, permissionsInput,
  permissionsWithin, policyInput, statusInput, targetMayManage, validatePermissions,
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
    return { ...parsed, permissions: validatePermissions(parsed.permissions) };
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
  return { actor, grants: grants.filter(g => ["full", "limited"].includes(g.accessLevel))
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
async function accountState(tx: Tx, actor: Actor, employee: Employee, approved: EmployeeAccountPolicy) {
  if (!employee.linkedUserId) return null;
  const [account] = await tx.select(accountProjection).from(users).where(eq(users.id, employee.linkedUserId));
  if (!account) deny("INVALID_LINK", "رابط حساب الموظف غير صالح");
  const access = await tx.select({ branchId: userBranchAccess.branchId }).from(userBranchAccess).where(eq(userBranchAccess.userId, account.id));
  const assignments = await tx.select({ id: userAssignments.id }).from(userAssignments).where(eq(userAssignments.userId, account.id));
  const overrides = await tx.select({ id: userPermissionOverrides.id }).from(userPermissionOverrides).where(eq(userPermissionOverrides.userId, account.id));
  const direct = await tx.select({ module: userPermissions.module, actions: userPermissions.actions }).from(userPermissions).where(eq(userPermissions.userId, account.id));
  targetMayManage(actor.id, account, employee.branchId, access.map(g => g.branchId), assignments.length, overrides.length, direct, approved);
  if (!["active", "inactive"].includes(account.isActive ?? ""))
    deny("PROTECTED_ACCOUNT", "حالة الحساب تتطلب مراجعة مسؤول النظام");
  return {
    account, permissions: direct,
    canReactivate: approved.enabled
      && permissionsWithin(effectiveDelegatedPermissions(account, direct), approved.permissions)
      && (actor.role === "admin" || await suspensionOwned(tx, account, employee)),
  };
}
async function dto(tx: Tx, actor: Actor, employee: Employee, approved: EmployeeAccountPolicy): Promise<DelegatedEmployeeAccount> {
  const state = await accountState(tx, actor, employee, approved);
  const [branch] = await tx.select({ name: branches.name }).from(branches).where(eq(branches.id, employee.branchId));
  return {
    employeeId: employee.id, employeeName: employee.employeeName,
    branchId: employee.branchId, branchName: branch?.name ?? employee.branchId,
    account: state ? {
      id: state.account.id, username: state.account.username,
      isActive: state.account.isActive as "active" | "inactive",
      permissions: state.permissions, canReactivate: state.canReactivate,
    } : null,
  };
}
async function replacePermissions(tx: Tx, id: string, selected: DelegatedPermission[]) {
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

  app.get("/api/operations/employee-accounts", isAuthenticated, endpoint(async (req, res) => {
    const deadline = performance.now() + 10_000;
    const result = await db.transaction(async tx => {
      // Snapshot reads do not block legacy writers. Every query sees the same
      // fresh snapshot; writes retain their authoritative table locks below.
      // PostgreSQL versions before 17 lack transaction_timeout. Apply the
      // remaining transaction budget before each bounded batch instead.
      const remainingBudget = () => {
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) throw Object.assign(new Error("Directory deadline"), { code: "57014" });
        return remaining;
      };
      const budget = async () => {
        const remaining = remainingBudget();
        await tx.execute(sql`SELECT set_config('statement_timeout', ${String(remaining)}, true),
          set_config('idle_in_transaction_session_timeout', '10000', true)`);
      };
      await budget();
      const { actor, grants } = await actorState(tx, req.session.userId!, false, budget);
      await budget();
      const approved = await policy(tx);
      // Disabled approval still supplies the ceiling for reduction-only editing;
      // it does not authorize creation, expansion or reactivation.
      const available = actor.role === "admin" ? EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS : approved.permissions;
      const result: EmployeeAccountsResponse = {
        employees: [], policy: approved, availablePermissions: available,
        templates: delegationTemplates(approved.enabled ? approved.permissions : []),
      };
      // Policy withdrawal is prospective. Keep the safe minimal directory
      // visible so existing accounts can still be suspended or reduced.
      if (actor.role !== "admin" && !grants.length) return result;
      const scope = and(
        eq(branchEmployees.status, "active"), ne(branchEmployees.branchId, HQ_BRANCH_ID),
        actor.role !== "admin" ? inArray(branchEmployees.branchId, grants) : undefined,
      );
      const linked = tx.select({ id: branchEmployees.linkedUserId }).from(branchEmployees).where(scope);
      await budget();
      const employees = await tx.select({ ...employeeProjection, branchName: branches.name })
        .from(branchEmployees).leftJoin(branches, eq(branches.id, branchEmployees.branchId))
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
      const overrides = await tx.selectDistinct({ userId: userPermissionOverrides.userId }).from(userPermissionOverrides)
        .where(inArray(userPermissionOverrides.userId, linked));
      await budget();
      const direct = await tx.select({ userId: userPermissions.userId, module: userPermissions.module, actions: userPermissions.actions })
        .from(userPermissions).where(inArray(userPermissions.userId, linked));
      await budget();
      const markers = await tx.select({ key: portalSettings.key, value: portalSettings.value }).from(portalSettings)
        .where(inArray(portalSettings.key, tx.select({ key: sql<string>`'employee_account_delegation.suspension.' || ${branchEmployees.linkedUserId}` })
          .from(branchEmployees).where(scope)));
      const byAccount = new Map(accounts.map(a => [a.id, a]));
      const assigned = new Set(assignments.map(a => a.userId));
      const overridden = new Set(overrides.map(a => a.userId));
      const markerValues = new Map(markers.map(m => [m.key, m.value]));
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
      for (const employee of employees) {
        remainingBudget();
        try {
          let account: DelegatedEmployeeAccount["account"] = null;
          if (employee.linkedUserId) {
            const target = byAccount.get(employee.linkedUserId);
            if (!target) deny("INVALID_LINK", "رابط حساب الموظف غير صالح");
            const permissions = permissionsByUser.get(target.id) ?? [];
            targetMayManage(actor.id, target, employee.branchId, grantsByUser.get(target.id) ?? [],
              Number(assigned.has(target.id)), Number(overridden.has(target.id)), permissions, approved);
            if (!["active", "inactive"].includes(target.isActive ?? ""))
              deny("PROTECTED_ACCOUNT", "حالة الحساب تتطلب مراجعة مسؤول النظام");
            account = { id: target.id, username: target.username, isActive: target.isActive as "active" | "inactive",
              permissions, canReactivate: approved.enabled
                && permissionsWithin(effectiveDelegatedPermissions(target, permissions), approved.permissions)
                && (actor.role === "admin" || suspensionMatches(markerValues.get(suspensionKey(target.id)), target, employee)) };
          }
          result.employees.push({ employeeId: employee.id, employeeName: employee.employeeName,
            branchId: employee.branchId, branchName: employee.branchName ?? employee.branchId, account });
        }
        catch (error) {
          // Protected accounts aren't disclosed to operations, even as a count
          // or a user identifier. Mutation routes still return explicit denials.
          if (!(error instanceof DelegationError) || error.status !== 403) throw error;
        }
      }
      remainingBudget();
      return result;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(result);
  }, "employee_account_directory"));

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

  const mutate = (mode: "create" | "permissions" | "status"): RequestHandler => endpoint(async (req, res) => {
    const id = employeeId(req.params.employeeId);
    const input = mode === "status" ? statusInput.parse(req.body) : permissionsInput.parse(req.body);
    // Expensive CSPRNG/hash outside the lock; no credential or user is persisted
    // unless every authoritative check succeeds inside the transaction.
    const credentials = mode === "create" ? generatedCredentials() : null;
    const passwordHash = credentials ? await bcrypt.hash(credentials.password, 12) : null;
    const result = await db.transaction(async tx => {
      await lockDelegationState(tx);
      const { actor, grants } = await actorState(tx, req.session.userId!);
      const approved = await policy(tx);
      if (!approved.enabled && (mode === "create" || ("isActive" in input && input.isActive === "active")))
        deny("DELEGATION_DISABLED", "التفويض غير مفعّل: يمكن عرض الحسابات وتعليقها وتقليل صلاحياتها فقط");
      const [employee] = await tx.select(employeeProjection).from(branchEmployees).where(eq(branchEmployees.id, id)).for("update");
      if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
      branchMayManage(actor, employee.branchId, grants);
      if (employee.status !== "active") deny("EMPLOYEE_INACTIVE", "يلزم موظف مسجل ونشط في الفرع");
      const state = await accountState(tx, actor, employee, approved);
      const selected = "permissions" in input ? validatePermissions(input.permissions, approved.permissions) : null;
      if (mode === "create") {
        if (state) throw new DelegationError(409, "ACCOUNT_ALREADY_LINKED", "الموظف مرتبط بحساب بالفعل");
        // Descriptive HR titles never become admin/RBAC roles. The sole
        // title-dependent auth behavior (delivery) is explicitly ceiling-checked.
        const jobTitle = employee.jobTitle === "delivery" ? "delivery" : null;
        enforceIntrinsicSelection(jobTitle, selected!);
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
        await audit(tx, actor, "account_create", employee, { permissions: selected, role: "employee" }, account.id);
      } else {
        if (!state) throw new DelegationError(409, "ACCOUNT_NOT_LINKED", "لا يوجد حساب مرتبط بالموظف");
        const account = state.account;
        if (mode === "permissions") {
          enforceIntrinsicSelection(account.jobTitle, selected!);
          const existingEffective = effectiveDelegatedPermissions(account, state.permissions);
          // Disabled policies and accounts outside a narrowed approval may only
          // lose permissions, never exchange them for new rights. The requested
          // result was already validated against the current approved ceiling.
          if ((!approved.enabled || !permissionsWithin(existingEffective, approved.permissions))
              && !permissionsWithin(selected!, existingEffective))
            deny("REDUCTION_ONLY", "بعد سحب التفويض يسمح بتقليل الصلاحيات الحالية إلى الحدود المعتمدة فقط");
          await storage.invalidateAllUserSessions(account.id, tx);
          await replacePermissions(tx, account.id, selected!);
          await audit(tx, actor, "permissions_update", employee, { before: state.permissions, after: selected }, account.id);
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
      return await dto(tx, actor, employee, approved);
    });
    if (result.account) invalidateAuthCache(result.account.id);
    res.status(mode === "create" ? 201 : 200).json({ employee: result, ...(credentials ? { credentials } : {}) });
  });
  app.post("/api/operations/employee-accounts/:employeeId", isAuthenticated, mutate("create"));
  app.put("/api/operations/employee-accounts/:employeeId/permissions", isAuthenticated, mutate("permissions"));
  app.patch("/api/operations/employee-accounts/:employeeId/status", isAuthenticated, mutate("status"));
}