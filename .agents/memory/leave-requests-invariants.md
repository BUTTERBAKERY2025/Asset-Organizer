---
name: Leave requests invariants
description: Non-obvious correctness/security rules for the leave-requests + leave-balances feature.
---

- **Balance "used" must be computed by year-overlap, not by startDate.** `getLeaveBalanceSummary` (server/leave-helpers.ts) sums only the calendar days of each approved leave that fall *inside* the requested year. A leave spanning Dec→Jan is split across both years.
  **Why:** counting by `startDate` charged the whole cross-year leave to the start year, corrupting next-year remaining/approval checks.

- **Create routes must override server-controlled state — `createInsertSchema` includes every non-omitted column.** `insertLeaveRequestSchema` only omits id/createdAt/updatedAt/reviewedBy/reviewedAt, so a client can send `status`, `currentLevel`, `requiredLevels`, `approvalFlow`, `cancel*`. The HR create route (server/hr-routes.ts) force-sets `status:"pending"`, `currentLevel:1`, `approvalFlow:[]`, clamps `requiredLevels` to 1..3, and nulls cancel fields. Apply the same pattern to any new write path.
  **Why:** otherwise an `hr_leaves` user could create pre-approved / pre-advanced requests, bypassing the balance check + approval chain.

- **Attendance sync/reversal on approve/cancel/delete is intentionally non-blocking + idempotent.** It uses a notes marker `__leave:<id>`; failures are logged, not thrown.
  **Why:** payroll/salary reads leave from `leave_requests` directly (not attendance), so attendance is non-authoritative; failing a manager's approval/cancel because of a transient attendance write would be worse, and re-running self-heals via the marker.

- **apiRequest throws a plain `Error` with message `"<status>: <body>"` — no `.data`.** To detect a structured server error (e.g. 409 `balance_exceeded`) on the client, slice the JSON out of `error.message` and parse it (see leaves.tsx review onError). Do not expect `error.data`.
