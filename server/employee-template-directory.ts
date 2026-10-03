import { sql } from "drizzle-orm";
import type { DelegatedEmployeeAccount } from "../shared/employee-account-delegation";

type EmployeeLink = { id: number; linkedUserId: string | null };
type Summary = NonNullable<DelegatedEmployeeAccount["templateAssignment"]>;

/** Read-only metadata; never used as evidence to grant account-management access. */
export async function readDirectoryTemplateAssignments(
  tx: { execute: (query: any) => Promise<any> },
  employees: EmployeeLink[],
): Promise<Map<number, Summary> | undefined> {
  const linked = employees.filter(e => e.linkedUserId);
  if (!linked.length) return new Map();
  const ready = await tx.execute(sql`SELECT
    to_regclass('public.employee_job_template_assignments') IS NOT NULL
    AND to_regclass('public.job_permission_template_draft_versions') IS NOT NULL
    AND to_regclass('public.job_permission_template_approvals') IS NOT NULL AS ready`);
  if (!ready.rows[0]?.ready) return undefined;
  const result = await tx.execute(sql`
    SELECT b.employee_id AS "employeeId", b.user_id AS "userId",
      b.template_id AS "templateId", b.version,
      v.content->>'name' AS name, (a.template_id IS NOT NULL) AS approved
    FROM public.employee_job_template_assignments b
    LEFT JOIN public.job_permission_template_draft_versions v
      ON v.template_id = b.template_id AND v.version = b.version
    LEFT JOIN public.job_permission_template_approvals a
      ON a.template_id = b.template_id AND a.version = b.version
    WHERE b.employee_id IN (${sql.join(linked.map(e => sql`${e.id}`), sql`, `)})`);
  const links = new Map(linked.map(e => [e.id, e.linkedUserId]));
  const summaries = new Map<number, Summary>();
  for (const row of result.rows) {
    // A stale binding for an earlier account must not describe the current one.
    if (links.get(row.employeeId) !== row.userId) continue;
    summaries.set(row.employeeId, {
      templateId: row.templateId, name: row.name || null,
      version: row.version, approved: row.approved === true,
    });
  }
  return summaries;
}