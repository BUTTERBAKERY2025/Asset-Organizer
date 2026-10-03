import { sql } from "drizzle-orm";
import { templateContentSchema } from "../shared/job-permission-templates";
import type { BranchTemplateBase } from "./branch-template-decision";

type Executor = { execute: (query: any) => Promise<any> };
export async function branchTemplateStorageReady(tx: Executor): Promise<boolean> {
  const result = await tx.execute(sql`SELECT to_regclass('public.branch_employee_template_assignments') IS NOT NULL AS ready`);
  return result.rows[0]?.ready === true;
}

/** Fresh reads only; no permission cache or silently invalid historical bases. */
export async function readBranchTemplateBases(tx: Executor, userId: string): Promise<BranchTemplateBase[]> {
  if (!await branchTemplateStorageReady(tx)) return [];
  const result = await tx.execute(sql`
    SELECT b.branch_id, b.user_id, b.employee_id, v.content,
      (a.template_id IS NOT NULL) AS approved,
      (e.linked_user_id = b.user_id AND e.branch_id = b.branch_id) AS linked
    FROM public.branch_employee_template_assignments b
    LEFT JOIN public.job_permission_template_draft_versions v
      ON v.template_id=b.template_id AND v.version=b.version
    LEFT JOIN public.job_permission_template_approvals a
      ON a.template_id=b.template_id AND a.version=b.version
    LEFT JOIN public.branch_employees e ON e.id=b.employee_id
    WHERE b.user_id=${userId}`);
  return result.rows.map((row: any) => {
    if (!row.approved || !row.linked) throw new Error("Invalid branch template authority binding");
    const content = templateContentSchema.parse(row.content);
    if (content.scopeType === "branches") throw new Error("Invalid branch template scope");
    return { branchId: row.branch_id, permissions: content.permissions };
  });
}