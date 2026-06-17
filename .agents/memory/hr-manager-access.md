---
name: HR manager cross-branch access
description: How the hr_manager role gets HR data — auto-granted modules, frontend perms reflection, and read-only cross-branch elevation.
---

# HR manager (`role === "hr_manager"`) access model

HR is a **cross-branch** function in this org. Three things must stay in sync or the HR Hub / HR pages render empty even though the page opens:

1. **`HR_MANAGER_MODULES`** (server/auth.ts) — the set of modules auto-granted to `hr_manager`. `requirePermission` / `requireAnyPermission` only auto-grant modules in this set. If a module an HR manager needs is missing (e.g. `branch_employees`, `shifts`, `attendance`, recruitment), those endpoints 403.

2. **`/api/my-permissions`** (server/routes.ts) — must MERGE the `hr_manager` auto-grant into the returned array, not just return explicit `user_permissions` rows. The frontend `usePermissions.canView/canEdit` reads this array for non-special roles, so without the merge the frontend hides HR sections/sub-pages.
   **Why:** backend authorizes via the auto-grant but frontend only knew about explicit DB rows → mismatch → hidden empty sections.

3. **Cross-branch READ elevation** — `hasCrossBranchHrReadAccess(req)` in server/auth.ts is the single source of truth (admin, OR role hr_manager, OR `hr_management:view`). A no-branch HR manager has empty `getAllowedBranchIds`/`getEffectiveBranchFilter`, so list/detail HR GETs return empty unless they consult this helper.
   - Applied to GET `/api/branch-employees`, `/api/branch-employees/stats`, `/api/attendance`, `/api/branch-employees/:id`, `/api/attendance/:id`. `/api/hr/*` routes already elevate (hr-routes.ts delegates its private `hasCrossBranchHrAccess` to the shared helper).
   - **READ-ONLY by design:** never elevate write paths (POST/PATCH/PUT/DELETE). Writes keep `getEffectiveBranchFilter`/`canAccessBranch` so cross-branch writes fail closed.
   - **Do NOT** put this elevation in the global `getAllowedBranchIds`/`getEffectiveBranchFilter` — that would leak finance/inventory/sales cross-branch. Apply it only inside HR endpoints.

**How to apply:** when adding any HR data GET endpoint, gate the branch check with `!hasCrossBranchHrReadAccess(req)`; when adding a new module an HR manager needs, add it to `HR_MANAGER_MODULES` (the my-permissions merge picks it up automatically).

## HR specialist (`role === "hr_specialist"`) — narrower sibling

Same 3-things-in-sync model as the manager, but driven by an **action-aware map** `HR_SPECIALIST_PERMISSIONS` (server/auth.ts, `Record<module, actions[]>`) instead of a flat module set. Narrower than the manager: **excludes `salary_closing`, `hr_eos`, `employee_transfers`, `organizational_structure`**; `branch_employees`/`employee_reports` are view+export only.

- `requirePermission`/`requireAnyPermission` have a dedicated `hr_specialist` branch: grant if module in the map AND (`action == null` OR action listed). Modules **not** in the map fall through to explicit `user_permissions` (so admin can still grant extras to one specialist).
- **Granularity caveat:** most `/api/hr/*` routes call `requirePermission("hr_*")` with NO action arg → `action===undefined` → for an included module the grant is effectively module-level (e.g. specialist CAN hit leave review/approve). True per-action limits only work where the route passes an explicit action (e.g. `branch_employees` create/edit/delete → blocked, view-only holds). To restrict further, the HR route itself must pass an action string.
- Cross-branch READ: `hasCrossBranchHrReadAccess` returns true for `hr_specialist` too; writes stay branch-scoped (specialist needs explicit `userBranchAccess` rows to write to other branches, same as a manager).
- `/api/my-permissions` has a separate merge block using `HR_SPECIALIST_PERMISSIONS` (action-aware, not all MODULE_ACTIONS). Role added to all valid-role lists + PRIVILEGED_ROLES/OP_PRIVILEGED_ROLES (admin-only assignment), and to `ROLES` in users.tsx + onboarding select.
- **No DB schema change** — `users.role` is a plain text column.

**Note:** the HR Hub page (`/hr-hub`) has NO frontend permission gating — it renders `/api/hr/hub-bundle` unconditionally. So an empty hub for a real `hr_manager` on current code means production is running OLDER code (deploy fixes it); the standalone employees/attendance pages are what items 1–3 fix.
