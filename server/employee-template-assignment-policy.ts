import { createHash } from "node:crypto";
import { z } from "zod";
import type { DelegatedPermission, EmployeeAccountPolicy } from "@shared/employee-account-delegation";
import { templateContentSchema, type TemplateContent } from "@shared/job-permission-templates";
import { deny, validatePermissions } from "./employee-account-delegation-policy";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS } from "@shared/employee-account-delegation";

// Reviewed branch-account template vocabulary. Applies to approved template
// versions, never to arbitrary delegated raw grants. No template-name special cases.
export const ADMIN_CASHIER_PERMISSIONS = [
  ...EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS.map(p => ({
    module: p.module, actions: [...p.actions, "view_list", "view_details"],
  })),
  ...["platform_home", "dashboard", "cashier", "cashier_performance", "incentives",
    "smart_incentives_challenges", "smart_incentives_commissions",
    "smart_incentives_bonus", "smart_incentives_wallet"].map(module => ({
    module, actions: ["view", "view_list", "view_details"],
  })),
  // Submission still requires create at the journal route. Preserve this
  // explicit template action; never alias it to create or grant create for it.
  { module: "cashier_journal", actions: ["submit"] },
];
export function validateAdminCashierPermissions(permissions: DelegatedPermission[]) {
  for (const p of permissions) for (const action of p.actions) {
    if (!ADMIN_CASHIER_PERMISSIONS.some(rule => rule.module === p.module && rule.actions.includes(action)))
      deny("ADMIN_TEMPLATE_PERMISSION_UNSUPPORTED", `صلاحية غير مدعومة لإسناد قوالب حسابات الفروع: ${p.module}:${action}. لم تُحذف من القالب.`);
  }
  const journalActions = permissions.filter(p => p.module === "cashier_journal").flatMap(p => p.actions);
  if (journalActions.includes("submit") && !journalActions.includes("create"))
    deny("JOURNAL_SUBMIT_REQUIRES_CREATE", "إرسال يومية الكاشير يتطلب صلاحية إنشاء اليومية في المسار الحالي. أضفها صراحةً إلى إصدار القالب واعتمده؛ لم نضف صلاحيات تلقائيًا.");
  return permissions;
}
export function eligibleAdminTemplatePermissions(raw: unknown, jobTitle: string | null, role: string) {
  const content = templateContentSchema.parse(raw);
  const permissions = validateAdminCashierPermissions(content.permissions.filter(p => p.actions.length));
  if (content.scopeType === "branches" || (content.scopeType === "self" && permissions.length))
    deny("TEMPLATE_SCOPE_FORBIDDEN", "هذا النطاق غير مدعوم في تجربة الحساب الفردي للأدمن");
  if (content.scopeType === "assigned_tasks" &&
    (jobTitle !== "delivery" || role !== "employee" || permissions.some(p => p.module !== "delivery_tasks")))
    deny("TEMPLATE_SCOPE_FORBIDDEN", "نطاق المهام المسندة يتطلب حساب توصيل وإجراءات التوصيل فقط");
  if (jobTitle === "delivery" && !permissions.some(p => p.module === "delivery_tasks" && p.actions.includes("view") && p.actions.includes("edit")))
    deny("INTRINSIC_AUTHORITY", "وظيفة التوصيل تتطلب عرض وتعديل مهام التوصيل");
  if (permissions.some(p => p.actions.some(a => a !== "view") && !p.actions.includes("view")))
    deny("VIEW_REQUIRED", "اختر صلاحية العرض مع إجراءات الوحدة");
  return { content, permissions: permissions.map(p => ({ module: p.module, actions: [...p.actions].sort() }))
    .sort((a, b) => a.module.localeCompare(b.module)) };
}

export const templateAssignmentInput = z.object({
  templateId: z.number().int().positive().max(2147483647),
  version: z.number().int().positive().max(2147483647),
  branchId: z.string().min(1).max(100),
  reason: z.string().trim().min(1).max(2000),
  expectedAssignmentRevision: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

/** Scope labels cannot constrain broad permissions by themselves. Only scopes
 * already enforced by resource routes are admitted here. No title mutations. */
export function eligibleTemplatePermissions(
  raw: unknown, approved: EmployeeAccountPolicy, jobTitle?: string | null, role = "employee",
): { content: TemplateContent; permissions: DelegatedPermission[] } {
  const content = templateContentSchema.parse(raw);
  if (!approved.enabled) deny("DELEGATION_DISABLED", "التفويض غير مفعّل");
  if (content.assignmentAuthority !== "delegated_operations" || content.scopeType === "branches")
    deny("TEMPLATE_SCOPE_FORBIDDEN", "القالب يتطلب إسناد مسؤول النظام أو نطاقاً غير مدعوم");
  // Empty action vocabulary rows have no effective authority and are omitted.
  // An approved delegated template is the authority for its complete base.
  // The old checkbox policy still controls raw grants, not approved versions.
  // Reuse the reviewed branch-operation vocabulary, never a template name.
  const permissions = validateAdminCashierPermissions(content.permissions.filter(p => p.actions.length))
    .map(p => ({ module: p.module, actions: [...p.actions].sort() }))
    .sort((a, b) => a.module.localeCompare(b.module));
  if (permissions.some(p => p.actions.some(a => a !== "view") && !p.actions.includes("view")))
    deny("VIEW_REQUIRED", "اختر صلاحية العرض مع إجراءات الوحدة");
  if (content.scopeType === "self" && permissions.length)
    deny("TEMPLATE_SCOPE_FORBIDDEN", "قالب البوابة الذاتية لا يمنح إجراءات إدارة الفرع");
  if (content.scopeType === "assigned_tasks"
      && (permissions.some(p => p.module !== "delivery_tasks")
        || (jobTitle !== undefined && (jobTitle !== "delivery" || role !== "employee"))))
    deny("TEMPLATE_SCOPE_FORBIDDEN", "قالب المهام المسندة يتطلب وظيفة التوصيل وإجراءات التوصيل فقط");
  if (jobTitle === "delivery" && !permissions.some(p => p.module === "delivery_tasks"
      && p.actions.includes("view") && p.actions.includes("edit")))
    deny("INTRINSIC_AUTHORITY", "وظيفة التوصيل تتطلب عرض وتعديل مهام التوصيل؛ راجع مسؤول النظام");
  return { content, permissions };
}

export function assignmentSnapshotRevision(snapshot: unknown, permissions: DelegatedPermission[]) {
  const canonical = permissions.map(p => ({ module: p.module, actions: [...p.actions].sort() }))
    .sort((a, b) => a.module.localeCompare(b.module));
  return createHash("sha256").update(JSON.stringify({ snapshot, permissions: canonical })).digest("hex");
}