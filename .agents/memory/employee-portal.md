---
name: بوابتي employee self-service portal
description: Architecture facts for the employee portal (my-portal) feature
---

## Identity & scoping
- Self endpoints live in `server/self-service-routes.ts` under `/api/my/*`, all scoped via
  `getMyEmployee(req)` which resolves `branchEmployees.linkedUserId === req.currentUser.id`.
- **linked_user_id must be one-to-one**: enforced by a UNIQUE index on
  `branch_employees(linked_user_id)` AND by API guards in link-user/create-account. A duplicate
  link would let one account resolve to an arbitrary employee (cross-employee data exposure).
  **Why:** getMyEmployee picks the first matching row; without uniqueness it is non-deterministic.

## Canonical attendance identifier
- Branch-employee attendance rows use `employeeId = "branch_emp_{branchEmployee.id}"`.
  `storage.checkInEmployee/checkOutEmployee` expect this format and validate the branch.
- Self check-in: GPS geofence (Haversine vs branch.latitude/longitude, radius
  `branch.locationRadius || 200`m) + signature are mandatory; biometric is optional/non-blocking.

## Portal settings (feature flags)
- `portal_settings` is a generic key/value table — adding new flags needs NO DB schema change.
  Boolean keys are listed in `PORTAL_BOOLEAN_KEYS`; value keys (e.g. `max_advance_amount`,
  `default_language` ar|en) are NOT booleans. Defaults in `PORTAL_SETTING_DEFAULTS`.
- Admin API (`/api/admin/portal-settings`) GET/PUT uses `buildPortalSettingsResponse`: returns
  real booleans for boolean keys, raw strings for value keys. PUT validates
  `max_advance_amount` numeric>=0 and `default_language` in {ar,en}.
- Self gating: `/api/my/portal-config` exposes all flags; POST `/api/my/leaves` is gated by
  `allow_leave_requests`, POST `/api/my/advance-requests` by `allow_advance_requests` +
  `max_advance_amount` — enforce server-side, never trust the client toggle.
- Admin account-linking: GET `/api/admin/portal-accounts` (users:view, branch-scoped via
  getEffectiveBranchFilter) + POST `/api/admin/portal-accounts/bulk-generate` (users:create,
  per-employee canAccessBranch check). **Generate credentials with node:crypto `randomInt`,
  never `Math.random()`** — it is not cryptographically secure for login passwords.

## Auto-linking employees to EXISTING user accounts (no-duplicate rule)
- Managers/cashiers often already have a `users` account; portal-only employees don't. Rule:
  if an employee matches an existing account → LINK it (no new account); else bulk-generate.
- Matching (`matchUserForEmployee` in routes.ts): **phone first** (`normalizePhone`: strip
  non-digits, drop 966/leading 0, compare last 9), **then exact normalized name**
  (`normalizeName`: strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta). Only shared
  fields between `users` and `branchEmployees` are phone & name (no national-id/empNumber on users).
- Flow is **suggest-then-confirm**, never blind auto-link: GET `/suggestions` lists matches,
  POST `/confirm-links` applies admin-selected ones. **Why:** a wrong link = cross-employee
  data exposure (getMyEmployee resolves by linkedUserId).
- Security invariants for the linking endpoints (all three were caught in review):
  1. Suggestions must exclude users linked in ANY branch (build linkedUserIds from a GLOBAL
     getAllBranchEmployees(), not the branch-scoped list) AND restrict candidate users to the
     requester's branch scope (`users.branchId` ∈ allowed set; null=admin).
  2. confirm-links must authz the TARGET user too (non-admin: user.branchId set + canAccessBranch),
     not just the employee's branch.
  3. `linkBranchEmployeeToUser` updates `WHERE id=? AND linked_user_id IS NULL` (atomic) and
     returns row only on success; caller treats falsy as a conflict skip.
- Why linking matters beyond logins: portal leaves/advances/attendance already share HR tables,
  but **attendance only appears in HR (`/hr-hub`) if the employee is linked** (linkedUserId).

## Bilingual (AR/EN) + employee photo
- Portal page (`client/src/pages/my-portal.tsx`) is bilingual via i18n `portal` namespace
  (`client/src/locales/{ar,en}/portal.json`, registered in `client/src/lib/i18n.ts`). Toggle
  calls `changeLanguage(...)`; `dir` follows language (rtl for ar, ltr for en). EN mode prefers
  `employeeNameEn` when present. Localized label lookups use `t("group.key",{defaultValue:key})`.
- Employee photo: `branch_employees.photo_url` column. `/api/my/profile` returns `photoUrl`
  (+ employeeNameEn/nationality/phoneNumber). Admin upload lives in branch-employees details
  dialog: POST /api/uploads?folder=employees -> PUT /api/branch-employees/:id { photoUrl }.
  PUT route already enforces branch_employees:edit + canAccessBranch (no IDOR).
