import { createHash } from "node:crypto";
import { z } from "zod";
import type { DelegatedPermission, EmployeeAccountPolicy } from "@shared/employee-account-delegation";
import { templateContentSchema, type TemplateContent } from "@shared/job-permission-templates";
import { deny, validatePermissions } from "./employee-account-delegation-policy";

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
  const permissions = validatePermissions(content.permissions.filter(p => p.actions.length), approved.permissions);
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