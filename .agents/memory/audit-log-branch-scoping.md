---
name: Audit log branch scoping
description: Server-side branch gating pattern required for audit/report list+analytics endpoints
---

Audit-log query/analytics endpoints must gate branches server-side, never trust the client's `branchId`.

**Why:** `requirePermission("users","view")` alone let a scoped user request any branch's logs (or all branches by omitting `branchId`) — cross-branch data exposure.

**How to apply:**
- Route: `getEffectiveBranchFilter(req, queryBranchId)` → `{branchIds, singleBranchId, hasAccess}`. Return empty payload on `!hasAccess`.
- Pass to storage: `branchId: singleBranchId ?? undefined` and `branchIds: singleBranchId ? undefined : branchIds`.
- Storage `buildAuditConditions`: when `branchId` set use `eq`; else if `branchIds` is an array use `inArray` (empty array → push `sql\`false\`` so it returns nothing); `branchIds === null` (admin) → no branch condition.
- Legacy/NULL `branch_id` rows are invisible to scoped (non-admin) users by design; admins (branchIds=null) still see everything.
- Keep list and analytics filters in lockstep: if the client sends `action/userId/q/sensitiveOnly` to one, the other must accept them too, or the Analytics tab silently diverges from the Logs tab.
