---
name: Auth — req.currentUser vs req.user
description: Where the logged-in user is attached on requests, and the safe pattern for status transitions
---

# Logged-in user lives on `req.currentUser`, not `req.user`

`isAuthenticated` (server/auth.ts) attaches the authenticated user as `req.currentUser`
(and `req.userBranchAccess`). It does NOT set `req.user`.

**Why it matters:** some older helpers (e.g. `getUserId` in server/hr-routes.ts) read
`req.user?.id || req.user?.claims?.sub`, which is usually null here — so `createdBy` /
`reviewedBy` audit fields silently come out null. For correct actor attribution use
`req.currentUser?.id` first.

**How to apply:** any new route helper that needs the current user id should prefer
`(req as any).currentUser?.id`. Branch scope for admin/HR reads/writes comes from
`getEffectiveBranchFilter(req)` in server/auth.ts (returns `{ branchIds: string[] | null, hasAccess }`;
`branchIds === null` means all-branches).

# Status-transition writes must be atomic (guarded UPDATE), not read-then-write

For approve/reject/cancel flows, do not check `status === 'pending'` in a SELECT and then
UPDATE by id only — two concurrent requests both pass the check and double-process
(e.g. creating duplicate salary_deductions on advance approval).

**How to apply:** put the guard in the UPDATE's WHERE (`and(eq(id), eq(status,'pending'))`)
and check `returning().length === 0` to detect "already processed". For approvals that also
insert a linked row, wrap in `db.transaction` and do the guarded UPDATE *first*; only insert
the dependent row when the guarded update claimed the request.
