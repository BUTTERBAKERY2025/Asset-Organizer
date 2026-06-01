---
name: Targeted messaging by position (branch isolation)
description: Security rule for the notifications-center "رسالة موجّهة بالمنصب" feature and any position/role-targeted broadcast.
---

# Position-targeted messaging must re-resolve recipients server-side

When sending a message targeted at a *position* (job title / role) across branches, the
send endpoint MUST re-resolve the authoritative recipient list on the server from
(jobTitle, authorized-branches) and only deliver to people the server itself resolves.
Treat any client-supplied `userId` / `phone` / `branchId` purely as a *filter* against
that authoritative set — never as the delivery target.

**Why:** A first build trusted the client's recipient list and only checked that
`branchId` was authorized. That let a caller with `settings:create` push one branch's
"smart" data (incomplete-employee / expiring-doc summaries) to an arbitrary user account
= cross-branch data disclosure (IDOR). Architect flagged it as a blocker.

**How to apply:**
- Resolve via the shared resolver that UNIONs `branch_employees.job_title` + `users.role/job_title`
  (active only), restricted to branches passed through the branch-access filter.
- Build each recipient's smart body from the SERVER-resolved `branchId`, so a manager only
  ever gets their own branch's issues.
- Dedupe recipients by key: userId → normalized phone → name+branchId.
- The completeness/expiry rules mirror employee-reports-dashboard.tsx (iqama/passport/health
  cert/nationality/phone/bank); expiring window 60d, health cert 30d. Keep them in sync.
