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

# Position matching: dropdown sends KEY, DB stores Arabic LABEL

`JOB_TITLE_LABELS` maps English key → Arabic label (`cashier`→`كاشير`, `branch_manager`→`مدير فرع`).
The position dropdown sends the KEY, but `branch_employees.job_title` stores the Arabic LABEL,
and `users.role` only ever holds RBAC values (`admin`/`employee`/`viewer`) — NEVER positions.
So the resolver must match job_title/role against BOTH the key and `JOB_TITLE_LABELS[key]`.
**Why:** matching only the key returned 0 recipients for every position (silent empty result).
**Note:** some real positions (e.g. `مدير صالة` hall-manager) aren't in JOB_TITLE_LABELS at all,
so they can't be selected — a data-taxonomy gap, not a code bug.

# drizzle raw sql cannot bind a JS array to ANY()

In `db.execute(sql\`...\`)`, a bare `${jsArray}` is serialized as a record tuple `(a,b)`, NOT a
Postgres array. `= ANY(${arr})` throws `op ANY/ALL (array) requires array on right side`, and
`${arr}::text[]` throws `cannot cast type record to text[]`. Use an expand-to-params helper:
`sql.join(arr.map(v => sql\`${v}\`), sql\`, \`)` with `IN (${...})`. Caller MUST guard non-empty
(`IN ()` is invalid SQL); the `inList` helper in routes.ts throws on empty input.
**Why:** all 4 position-messaging queries 500'd until switched from ANY(array) to IN(expanded).
