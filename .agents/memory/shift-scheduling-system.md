---
name: Shift scheduling (جدولة الدوام) system map & known gaps
description: How the weekly employee shift scheduler works end-to-end and its non-obvious risks/gaps.
---

Page `client/src/pages/shift-management.tsx` (weekly grid). Loads everything via ONE bundle
endpoint `GET /api/shift-management/bundle?branchId&startDate&endDate` → {shiftProfiles,
employees, schedules, attendance, weeklyLock}. Saves via `POST /api/employee-schedules/bulk`.
Lock via `GET/POST /api/weekly-schedule-locks`. Audit via `/api/schedule-change-audit`.
Storage: `createBulkEmployeeSchedules` / `getEmployeeSchedulesByBranchAndDateRange` in storage.ts.

**Employee identity is DUAL** — every schedule row carries both `employeeId` (string:
user UUID *or* `branch_emp_<id>`) and `branchEmployeeId` (int). This duality is the root of
all historical duplicate/"schedule reverts on reload" bugs. Dedup logic is duplicated in THREE
places (read in storage, bulk-save in storage, startup migration in db.ts). Touch one, keep all in sync.
**CANONICAL identity is `branchEmployeeId` (int).** The `employeeId` string is the legacy/alt form
of the same person. The frontend grid ALWAYS sends `branchEmployeeId: employee.id` (shift-management.tsx),
so NEW rows are never created with a NULL branchEmployeeId from that page — remaining NULLs are legacy only.
**RESOLVED (prod backfill, 2026-06-04):** all 16,986 prod rows backfilled so 100% carry branchEmployeeId
(0 NULL remaining). Method = resolve NULL rows to a branchEmployee id via `branch_emp_<id>` suffix OR
`branch_employees.linked_user_id` match in same branch; DELETE legacy NULL rows that collided with an
existing canonical row; UPDATE the rest. Reversible via full snapshot table `employee_schedules_backup_20260604`.
Run on Supabase (prod). Data-only migration — NO code/schema change was needed (runtime already handles both).

**Upsert depends on TWO PARTIAL unique indexes created at app startup in `server/db.ts`**
(not by drizzle push): `idx_unique_schedule_per_employee_date_branch` (branch_employee_id,
schedule_date, branch_id WHERE branch_employee_id NOT NULL) and
`idx_unique_schedule_per_empid_date_branch` (employee_id,... WHERE branch_employee_id NULL).
**Schema drift:** shared/schema.ts declares the first index as NON-partial and does NOT declare
the second at all. The ON CONFLICT ... WHERE clauses in storage require the PARTIAL versions.
**Why it matters:** if the db.ts startup DDL doesn't run in prod, every bulk save fails with
PG 42P10 — and the catch only falls back on 42704, so it surfaces as a total save failure, not
a graceful per-row fallback.

**Weekly lock MUST be enforced server-side, not just in the UI.** All 4 schedule write
routes (single/bulk POST, PATCH, DELETE) check `weekly_schedule_locks` and return HTTP 423
for non-admins; admins bypass (acts as the override path — there is no unlock screen).
**Why:** UI-only locking let copyToNextWeek and direct API calls overwrite finalized weeks.
**How to apply:** the lock key is `branchId__weekStartDate` where weekStartDate is the SATURDAY
of the week (client `startOfWeek(weekStartsOn:6)`); the server recomputes it from each row's date.
**Lock-bypass trap:** the week-start helper must REJECT non-canonical date strings (only
`^\d{4}-\d{2}-\d{2}$`) and routes must 400 on bad format BEFORE the lock check — otherwise a
crafted date (e.g. "20260606") fails lock matching yet still inserts into the locked week.

**Bulk-save fallback must catch BOTH 42704 and 42P10** (+ "no unique or exclusion constraint"
message) and fall back to per-row SELECT-then-insert. **Why:** if the partial unique indexes
aren't present, ON CONFLICT throws 42P10; catching only 42704 turned a recoverable case into a
total silent save failure. shared/schema.ts now declares both PARTIAL indexes to match db.ts.

**Still-open gaps (not yet fixed):**
- "all" branch mode can't schedule: bundle returns empty for branchId="all" and save sends
  branchId="all" → server 400 (branch not found). No UI guard on save/apply for "all" (copy/export do guard).
- No optimistic/row versioning → concurrent editors of same branch+week silently overwrite (last-write-wins) until locked.
- Invalid times silently coerced to 08:00/16:00 in storage (console.warn only).
- Friday (week starts Saturday, index===6) hardcoded as the off day in apply-profile helpers.

**Inactive (terminated) employees are READ-ONLY, not hidden (decision 2026-06-04, Option A).**
Their existing schedules stay VISIBLE in the grid + reports/exports, but cannot be created/edited/deleted.
**Why:** users complained terminated staff's schedules silently vanished from view AND silent-skip on save.
**How to apply (3 layers, keep in sync):** (1) read fn includes all branch emps (active+inactive) not just active;
(2) bundle returns active emps + inactive emps that have schedules in range; (3) frontend shows them with a
"غير نشط" badge, disabled controls, blocked edit handlers, and skips them in save/copy/applyDefault.
**CRITICAL — UI guards are NOT enough:** immutability MUST be enforced server-side on ALL FOUR schedule write
routes (POST single, POST bulk, PATCH, DELETE) via a shared helper that resolves the target's status from
branchEmployeeId / `branch_emp_<id>` / linkedUserId and returns 409 — applied to admins too. A script could
otherwise overwrite a terminated employee's schedule.
