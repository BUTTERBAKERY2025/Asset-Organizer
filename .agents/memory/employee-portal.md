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
- `portal_settings` is a key/value table. Known keys in `PORTAL_SETTING_KEYS`:
  `show_salary` (default false), `allow_self_checkin` (default true).
- Storage returns string "true"/"false"; admin API (`/api/admin/portal-settings`) converts to
  real booleans both ways so the frontend toggles reflect true persisted state.

## Bilingual (AR/EN) + employee photo
- Portal page (`client/src/pages/my-portal.tsx`) is bilingual via i18n `portal` namespace
  (`client/src/locales/{ar,en}/portal.json`, registered in `client/src/lib/i18n.ts`). Toggle
  calls `changeLanguage(...)`; `dir` follows language (rtl for ar, ltr for en). EN mode prefers
  `employeeNameEn` when present. Localized label lookups use `t("group.key",{defaultValue:key})`.
- Employee photo: `branch_employees.photo_url` column. `/api/my/profile` returns `photoUrl`
  (+ employeeNameEn/nationality/phoneNumber). Admin upload lives in branch-employees details
  dialog: POST /api/uploads?folder=employees -> PUT /api/branch-employees/:id { photoUrl }.
  PUT route already enforces branch_employees:edit + canAccessBranch (no IDOR).
