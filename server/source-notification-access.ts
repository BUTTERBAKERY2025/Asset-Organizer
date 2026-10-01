import type { Request, Response } from "express";
import { pool } from "./db";

/** Fresh, request-equivalent read gate for background/recipient projections.
 * Query parameters and stored target IDs never constitute permission grants. */
export async function sourceNoticeAccess(userId: string) {
  const { rows } = await pool.query(`SELECT id,role,branch_id AS "branchId",
    job_title AS "jobTitle",is_active AS "isActive" FROM users WHERE id=$1 AND is_active='active'`, [userId]);
  const user = rows[0];
  if (!user) return null;
  const { rows: grants } = await pool.query(`SELECT branch_id AS "branchId" FROM user_branch_access WHERE user_id=$1`, [userId]);
  const { getAllowedBranchIds, requirePermission } = await import("./auth");
  const req = { currentUser: user, userBranchAccess: grants, method: "GET", headers: {},
    originalUrl: "/api/source-notification-projection" } as unknown as Request;
  const allowed = getAllowedBranchIds(req);
  const permitted = new Map<string, boolean>();
  return {
    user, allowed,
    branch: (id: string | null | undefined) => !!id && (allowed === null || allowed.includes(id)),
    async view(module: string): Promise<boolean> {
      if (permitted.has(module)) return permitted.get(module)!;
      // Role auto-grants must never resurrect an explicitly revoked view CTA.
      const { rowCount } = await pool.query(`SELECT 1 FROM user_permission_overrides o
        JOIN permissions p ON p.id=o.permission_id
        WHERE o.user_id=$1 AND p.module=$2 AND p.action='view' AND o.allow=false
        AND (o.expires_at IS NULL OR o.expires_at>now())`, [userId, module]);
      const result = !rowCount && await new Promise<boolean>((resolve, reject) => {
        const response = { status: () => response, json: () => resolve(false) } as unknown as Response;
        Promise.resolve(requirePermission(module, "view")(req, response,
          err => err ? reject(err) : resolve(true))).catch(reject);
      });
      permitted.set(module, result);
      return result;
    },
  };
}

export type SourceNoticeAccess = NonNullable<Awaited<ReturnType<typeof sourceNoticeAccess>>>;