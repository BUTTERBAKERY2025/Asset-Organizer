import { sql } from "drizzle-orm";
import type { db } from "./db";
import type { DelegatedPermission } from "@shared/employee-account-delegation";
import { eligibleTemplatePermissions } from "./employee-template-assignment-policy";
import { DelegationError, permissionsWithin } from "./employee-account-delegation-policy";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Binding = { employeeId: number; branchId: string; permissions: DelegatedPermission[] };

/** Historical approved bindings authorize continued management, not automatic
 * migration to the newest version. Missing metadata never relaxes protection. */
export async function readVerifiedTemplateBases(tx: Tx, userIds: string[]) {
  const bases = new Map<string, Binding>();
  if (!userIds.length) return bases;
  const ready = await tx.execute(sql`SELECT
    to_regclass('public.employee_job_template_assignments') IS NOT NULL
    AND to_regclass('public.job_permission_template_draft_versions') IS NOT NULL
    AND to_regclass('public.job_permission_template_approvals') IS NOT NULL
    AND to_regclass('public.user_permission_source_modes') IS NOT NULL AS ready`);
  if (!(ready.rows[0] as any)?.ready) return bases;
  const result = await tx.execute(sql`SELECT b.user_id AS "userId", b.employee_id AS "employeeId",
    b.branch_id AS "branchId", v.content, u.role, u.job_title AS "jobTitle"
    FROM public.employee_job_template_assignments b
    JOIN public.job_permission_template_draft_versions v ON v.template_id=b.template_id AND v.version=b.version
    JOIN public.job_permission_template_approvals a ON a.template_id=v.template_id AND a.version=v.version
    JOIN public.user_permission_source_modes s ON s.user_id=b.user_id AND s.source_mode='direct'
    JOIN public.users u ON u.id=b.user_id
    JOIN public.branch_employees e ON e.id=b.employee_id AND e.linked_user_id=b.user_id AND e.branch_id=b.branch_id
    WHERE b.user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})
    AND NOT EXISTS (SELECT 1 FROM public.branch_employees duplicate
      WHERE duplicate.linked_user_id=b.user_id AND duplicate.id<>b.employee_id)`);
  for (const row of result.rows as any[]) {
    try {
      const { permissions } = eligibleTemplatePermissions(row.content, { enabled: true, permissions: [] }, row.jobTitle, row.role);
      bases.set(row.userId, { employeeId: row.employeeId, branchId: row.branchId, permissions });
    } catch (error) {
      if (!(error instanceof DelegationError) && (error as any)?.name !== "ZodError") throw error;
    }
  }
  return bases;
}
export function matchesVerifiedTemplateBase(base: Binding | undefined,
  employee: { id: number; branchId: string }, direct: DelegatedPermission[]) {
  return !!base && base.employeeId === employee.id && base.branchId === employee.branchId
    && permissionsWithin(direct, base.permissions) && permissionsWithin(base.permissions, direct);
}