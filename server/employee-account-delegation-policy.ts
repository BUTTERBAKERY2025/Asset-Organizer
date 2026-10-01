import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS,
  type DelegatedPermission, type EmployeeAccountPolicy, type EmployeeAccountTemplate,
} from "@shared/employee-account-delegation";
import { HQ_BRANCH_ID } from "@shared/employee-organization";

export class DelegationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function deny(code: string, message: string): never {
  throw new DelegationError(403, code, message);
}
const permission = z.object({
  module: z.string().min(1).max(100),
  actions: z.array(z.string().min(1).max(40)).min(1).max(10),
}).strict();
export const permissionsInput = z.object({ permissions: z.array(permission).max(30) }).strict();
export const policyInput = permissionsInput.extend({ enabled: z.boolean() }).strict();
export const statusInput = z.object({ isActive: z.enum(["active", "inactive"]) }).strict();

export function permissionsWithin(requested: DelegatedPermission[], allowed: DelegatedPermission[]) {
  return requested.every(p => p.actions.every(a => allowed.some(c => c.module === p.module && c.actions.includes(a))));
}
export function validatePermissions(requested: DelegatedPermission[], allowed = EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS) {
  const modules = new Set<string>();
  for (const p of requested) {
    if (modules.has(p.module) || new Set(p.actions).size !== p.actions.length)
      throw new DelegationError(400, "DUPLICATE_PERMISSION", "لا تكرر الوحدات أو الإجراءات");
    modules.add(p.module);
  }
  if (!permissionsWithin(requested, EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS) || !permissionsWithin(requested, allowed))
    deny("PERMISSION_NOT_APPROVED", "الصلاحيات المطلوبة غير معتمدة للتفويض");
  return requested.map(p => ({ module: p.module, actions: [...p.actions].sort() })).sort((a, b) => a.module.localeCompare(b.module));
}
export const DEFAULT_POLICY: EmployeeAccountPolicy = { enabled: false, permissions: [] };

export function actorMayManage(actor: { role: string; isActive: string | null }, adminOnly = false) {
  if (actor.isActive !== "active" || (actor.role !== "admin" && (adminOnly || actor.role !== "operations_manager")))
    deny("DELEGATION_FORBIDDEN", "هذه الخدمة متاحة لمدير النظام ومدير التشغيل المخول فقط");
}
export function branchMayManage(actor: { role: string }, branchId: string, grants: string[]) {
  if (branchId === HQ_BRANCH_ID || (actor.role !== "admin" && !grants.includes(branchId)))
    deny("BRANCH_FORBIDDEN", "الفرع خارج نطاق التفويض أو تابع للمركز الرئيسي");
}
export function targetMayManage(
  actorId: string,
  target: { id: string; role: string; branchId: string | null; jobTitle?: string | null },
  branchId: string,
  grants: string[],
  assignments: number,
  overrides: number,
  direct: DelegatedPermission[],
  _policy: EmployeeAccountPolicy,
) {
  if (target.id === actorId || !["employee", "viewer"].includes(target.role))
    deny("PROTECTED_ACCOUNT", "لا يمكن إدارة حسابك أو الحسابات الإدارية والمحمية");
  if (target.branchId !== branchId || grants.some(id => id !== branchId))
    deny("EXTRA_BRANCH_AUTHORITY", "الحساب مرتبط بفرع آخر أو يملك صلاحيات متعددة الفروع");
  // Reject even dormant assignments/overrides: clearing direct rows can revive
  // inherited permissions, and future-dated assignments must not be weaponized.
  if (assignments || overrides || !permissionsWithin(direct, EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS))
    deny("ELEVATED_ACCOUNT", "الحساب يملك صلاحيات موروثة أو إضافية؛ يتطلب إدارة مسؤول النظام");
  // Current admin approval is prospective, not target identity: withdrawal must
  // not hide an otherwise safe account or prevent reducing/suspending its access.
  // Unknown/global permissions and inherited RBAC remain categorically protected.
}
export function effectiveDelegatedPermissions(target: { role: string; jobTitle?: string | null }, direct: DelegatedPermission[]) {
  // auth.ts grants these actions intrinsically; row deletion cannot remove them.
  return target.role === "employee" && target.jobTitle === "delivery"
    ? [...direct, { module: "delivery_tasks", actions: ["view", "edit"] }] : direct;
}

export function generatedCredentials() {
  return {
    username: `e${randomBytes(7).toString("hex")}`,
    password: `Aa9!${randomBytes(24).toString("base64url")}`,
  };
}
export function delegationTemplates(allowed: DelegatedPermission[]): EmployeeAccountTemplate[] {
  const definitions = [
    { id: "cashier", name: "كاشير", modules: ["cashier_journal"] },
    { id: "quality_inspector", name: "إنتاج ومراقبة الجودة", modules: ["quality_control"] },
    { id: "maintenance", name: "فني صيانة", modules: ["maintenance"] },
    { id: "branch_service", name: "خدمة الفرع", modules: ["branch_complaints"] },
    { id: "delivery", name: "التوصيل", modules: ["delivery_tasks"] },
  ];
  return definitions.map(({ id, name, modules }) => ({
    id, name, permissions: allowed.filter(p => modules.includes(p.module)).map(p => ({ ...p, actions: [...p.actions] })),
  })).filter(t => t.permissions.length > 0);
}

/** Whole-path predicate, applied before legacy route registration, including reads. */
export function isLegacyAccountPath(path: string, method: string, _body?: unknown) {
  let normalized: string;
  try { normalized = decodeURIComponent(path.split("?")[0]).replace(/\/+/g, "/").toLowerCase(); }
  catch { return true; }
  if (/^\/api\/(?:users|rbac|roles|permissions|permission-audit-logs|job-role-permissions|operations-employees|security|backups)(?:\/|$)/.test(normalized)) return true;
  if (/^\/api\/admin\/(?:portal-accounts|portal-settings)(?:\/|$)/.test(normalized)) return true;
  if (/^\/api\/audit\/auditor-accounts(?:\/|$)/.test(normalized)) return true;
  if (/^\/api\/hr\/onboarding\/[^/]+\/convert(?:\/|$)/.test(normalized)) return true;
  if (/^\/api\/governance\/shareholders\/[^/]+\/(?:create-account|reset-password|send-credentials|unlink-account)(?:\/|$)/.test(normalized)) return true;
  if (/^\/api\/branch-employees\/[^/]+\/(?:create-account|reset-password|link-user|unlink-user)(?:\/|$)/.test(normalized)) return true;
  // Generic employee writes accept linkedUserId through the shared schema.
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
      && /^\/api\/branch-employees(?:\/|$)/.test(normalized)) return true;
  return false;
}