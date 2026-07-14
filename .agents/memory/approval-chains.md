---
name: Approval chains (نظام الموافقات والاعتمادات)
description: Per-branch, job-title-based approval chains layered on the existing leave_requests multi-level infra.
---

# Approval chains for leave requests

Per-branch approval chains (currently `requestType = "leave"` only, max 3 levels). The
approver at each step is identified by an org **job title** (matched against
`org_job_roles.title_ar` / `branch_employees.job_title`), not a specific user.

**Reuses existing leave multi-level infra:** `leave_requests.currentLevel` /
`requiredLevels` / `approvalFlow`. A new nullable `approvalChain` jsonb column on
`leave_requests` stores a **snapshot** of the resolved chain at creation time, so later
edits to the workflow don't retroactively change in-flight requests.

**Resolution order:** branch-specific active workflow first, then the default workflow
(`branch_id IS NULL`) active. No applicable chain → falls back to legacy single-level
behavior (this is the backward-compat path; never assume a chain exists).

**Why two unique indexes, not one:** Postgres treats NULLs as distinct, so a plain
unique on `(request_type, branch_id)` would allow many default rows. There are two
partial unique indexes: `(request_type, branch_id) WHERE branch_id IS NOT NULL` for
branch rows and `(request_type) WHERE branch_id IS NULL` for the single default row.
**How to apply:** any new request-type scope must keep both indexes in lockstep, or the
PUT upsert's `limit(1)` selection becomes nondeterministic under concurrent writes.

**Review enforcement gotcha:** the job-title match check in `/api/hr/leaves/:id/review`
must gate **both** `approved` and `rejected` decisions (admin/super_admin override only).
A reject is as authoritative as an approve — gating only approvals lets a wrong-position
reviewer kill a request. Self-service create and HR create both set `requiredLevels` from
the chain length and persist the `approvalChain` snapshot.

Settings UI at `/approval-settings` (module `settings`); CRUD at `/api/approval-workflows*`
all behind `requirePermission("settings")`.

**Backfilling pre-existing pending requests:** requests created before a chain was
configured keep `approvalChain = null` and therefore never enter the multi-level flow —
they stay single-level. Configuring a chain does NOT retroactively touch them (snapshot
model). Fixing them needs an explicit backfill that resolves the branch chain and sets
`approvalChain` + `requiredLevels` + `currentLevel=1`.
**Why guarded UPDATE, not read-then-write:** a select-then-update-by-id backfill has a
TOCTOU race — a reviewer can approve between the read and the write, and the backfill
would clobber `currentLevel` back to 1 on an in-flight request. The UPDATE must re-assert
the guards in its WHERE (`status='pending'`, chain empty, no `decision` in `approvalFlow`)
and count only actually-affected rows.

## Review route is action-gated + branch_manager role (2026-07-14)
`/api/hr/leaves/:id/review` now requires `hr_leaves:approve` explicitly (it was
bare requirePermission → POST inferred "create", so anyone who could SUBMIT a
leave could also review one). Any role/user meant to approve leaves must carry
the approve action: branch_manager & operations_manager templates and
HR_SPECIALIST_PERMISSIONS.hr_leaves all include it; hr_manager passes via
module bypass. Existing explicit user_permissions rows WITHOUT approve lose
review — grant approve via the permissions dialog.
New role `branch_manager` (مدير فرع): branch-scoped (standard user_branch_access
path, NO auth.ts bypasses — template rows only), designed as chain level 1
(job title "مدير الفرع") before level 2 "مدير التشغيل"; reviewer matching stays
job-title based, so the branch manager USER must have jobTitle "مدير الفرع".
