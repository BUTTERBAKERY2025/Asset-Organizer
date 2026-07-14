---
name: financial_manager role
description: Cross-branch Financial Manager RBAC role — every surface that must treat it as all-branches, or its branch selector / large-payment approval silently break.
---

# financial_manager (المدير المالي) role

A cross-branch financial role: approves + confirms payment transfers, closes
payroll, monitors employees/salaries, financial reporting/audit. Excludes
users/settings/rbac.

## Adding a NEW cross-branch role touches MANY surfaces — miss one and it breaks subtly
`users.role` is a free varchar (no DB enum, no schema migration to add a role),
but the role only works if EVERY branch/authorization surface is updated in sync:

1. **Permission template** — `ROLE_PERMISSION_TEMPLATES` (shared/schema.ts). Applied
   to `user_permissions` when an admin picks the role in users.tsx. Without it the
   role has zero permissions.
2. **Role-assignment allowlists** (server/routes.ts) — there are SIX: two
   `PRIVILEGED_ROLES`/`OP_PRIVILEGED_ROLES` Sets (admin-only assignment) AND four
   `[...].includes(role)` validation arrays across the users-create, users-update,
   and operations-create endpoints. Omit the role from a validation array → "دور
   غير صالح"/"Invalid role" on assignment. Omit from a PRIVILEGED set → non-admins
   could assign it.
3. **Branch selector visibility** — all-branches is gated on ADMIN ONLY in TWO
   independent spots: `GET /api/branches` (routes.ts) and the auth-init branch
   filter (auth.ts, the `/api/auth/user` bootstrap). getAllowedBranchIds returning
   null is NOT enough — the branch dropdown reads these two, so a cross-branch role
   without explicit user_branch_access rows gets an EMPTY branch selector.
4. **getAllowedBranchIds** (auth.ts) → return null (all branches) for data queries
   via getEffectiveBranchFilter / checkProjectBranchAccess.
5. **canAccessBranch** (auth.ts, used ~300×) — only bypasses for admin; add the role
   or it's blocked on per-branch verified routes (e.g. /api/branches/:id).

**Why:** admin-only gating is duplicated across many helpers/routes that don't share
a single "is cross-branch" predicate, so each must be updated individually.

## Legacy `finance_manager` ≠ new `financial_manager`
A pre-existing role string `finance_manager` (underscore-different) already gates
large-payment approval and large contract-variation approval (routes.ts, the
`isAdmin`/`isExec` exec checks). To give the new financial_manager large-payment
approval, add it alongside `finance_manager` in the payment-approve large-amount
gate. (Contract-variation gate requires `contracts:edit`, which financial_manager
doesn't have, so it's out of scope there.)

## Action-name gotchas for the template
- payment_requests: action `approve` covers approve, reject, AND mark-paid routes.
- salary_closing: close/reopen use action `edit` (there is no salary_closing "approve").
- hr_advances / hr_eos: routes call requirePermission(module) with NO action → mere
  module presence grants; list any sensible actions.

## Auto-grant, not template-only — or a fresh user lands on /my-portal
A cross-branch role must be SELF-HEALING like hr_manager/hr_specialist: rely on an
auto-grant map, not on the template having been written to `user_permissions`.
**Why:** the template only populates `user_permissions` at role-assignment time; a
user created before deploy (or before the role existed) has zero rows, so
`/api/my-permissions` returns nothing, `canView` is false everywhere, and
platform-home redirects them to `/my-portal` ("حسابك غير مرتبط بملف موظف").
**How to apply:** three surfaces must agree (mirror hr_specialist exactly):
1. `requirePermission` AND `requireAnyPermission` (auth.ts) get an action-aware
   bypass for the role.
2. `/api/my-permissions` (routes.ts) MUST merge the same map, or the backend
   authorizes but the frontend sidebar/landing stays empty.
3. Build the auto-grant map from `ROLE_PERMISSION_TEMPLATES.<role>` so template and
   auto-grant never drift; keep pnl↔pnl_dashboard synonym tolerant.
Keeping the template is still useful (RBAC matrix UI + populates user_permissions on
assignment), but it is a bonus, not the mechanism.

## Client-side role hardcoding parallels backend RBAC — a second place to break
Backend auto-grant is necessary but NOT sufficient: several client pages hardcode
role checks that silently deny a permission-holding role.
- Salary closing pages gate the WHOLE page on `isAdmin || isHrManager` (a role
  string check, not a permission). Any role with `salary_closing:edit` must be added
  additively as `|| canEditModule("salary_closing")` — never replace the role checks
  (would regress hr_manager if their auto-grant lacks the module).
- **Salary deductions use a DIFFERENT module than closing**: closing/payments/
  attendance-adjust are `salary_closing:edit`, but manual deductions (`/api/salary-
  deductions` POST/PUT/DELETE) are `branch_employees:edit`. A monitoring-only role
  (branch_employees view+export) must have every deduction write surface hidden
  (bulk toolbar button AND the per-employee popover add/delete) via a separate
  `canManageDeductions` gate, or they see buttons that 403.
- **platform-home portal redirect**: `portalOnly` (empty view-perms → navigate
  /my-portal) must exclude known staff/management roles via a NON_PORTAL_ROLES set,
  else a transient empty-permissions window during navigation bounces them to the
  portal mid-session.
**Why:** the app authorizes on the backend by permission but decides UI visibility
by a mix of role strings AND permissions on the client; the two must be kept in sync
per page. **How to apply:** when adding a permission-based role, grep client pages for
`role === "..."` / `isHrManager` / `isAdmin ||` gates on the relevant feature and make
them additive with the matching `canView/canEdit(module)`.


## operations_manager (مدير التشغيل) mirrors this exact pattern (added 2026-07-12)
Second cross-branch role wired through the SAME checklist above: template,
auto-grant map + actionsFor synonyms (attendance_check/quality/waste),
requirePermission + requireAnyPermission bypasses, getAllowedBranchIds null,
canAccessBranch true, auth-init + /api/branches gates, my-permissions merge,
users.tsx ROLES, platform-home NON_PORTAL_ROLES. When adding a THIRD cross-branch
role, update both precedents or grep "financial_manager" and mirror every hit.
Note: the role-validation arrays in routes.ts are THREE (users-create,
users-update, operations-create), plus the two PRIVILEGED Sets.

## hr_leaves module-presence trap (least-privilege lesson)
Many /api/hr/leaves* routes were gated `requirePermission("hr_leaves")` with NO
action — so ANY role/user with the module (even view-only, e.g. viewer template)
could hit admin writes (leave balances, public holidays CRUD, settlements,
apply-chains, leave PATCH/DELETE). Fixed 2026-07-12: those 11 sensitive routes
now require `hr_leaves:edit` explicitly. operations_manager deliberately gets
hr_leaves WITHOUT edit (view/create/approve/export) so it can review/approve
leaves but not touch balances/holidays/settlements/provision-journal.
**How to apply:** when granting hr_leaves to a new role, decide edit vs no-edit
by whether it should reach those admin endpoints; review route needs only module
presence (approval chains gate by job title on top).

## Branch restriction semantics differ between the two cross-branch roles (2026-07-14)
operations_manager: all branches ONLY when the user has NO user_branch_access
rows; if the admin ticked specific "الفروع المسموحة", those rows WIN (enforced in
canAccessBranch, getAllowedBranchIds, auth-init filter, GET /api/branches — all
four must stay in sync). financial_manager remains unconditionally all-branches.
**Why:** admin unchecked a branch for an ops manager and the role bypass leaked
that branch's data anyway — reported as a security hole.
**How to apply:** any new cross-branch role must decide explicitly: hard
all-branches (FM style) or restriction-respecting (ops style); implement the
choice in ALL four surfaces.
