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

**Upsert depends on TWO PARTIAL unique indexes created at app startup in `server/db.ts`**
(not by drizzle push): `idx_unique_schedule_per_employee_date_branch` (branch_employee_id,
schedule_date, branch_id WHERE branch_employee_id NOT NULL) and
`idx_unique_schedule_per_empid_date_branch` (employee_id,... WHERE branch_employee_id NULL).
**Schema drift:** shared/schema.ts declares the first index as NON-partial and does NOT declare
the second at all. The ON CONFLICT ... WHERE clauses in storage require the PARTIAL versions.
**Why it matters:** if the db.ts startup DDL doesn't run in prod, every bulk save fails with
PG 42P10 — and the catch only falls back on 42704, so it surfaces as a total save failure, not
a graceful per-row fallback.

**Known gaps (as of this audit, no fix applied — user wanted report only):**
- Weekly lock is enforced ONLY in the frontend. `POST /api/employee-schedules/bulk` does NOT
  check `weekly_schedule_locks`, so copyToNextWeek and any direct API call can write to a locked week.
- "all" branch mode can't schedule: bundle returns empty for branchId="all" and save sends
  branchId="all" → server 400 (branch not found). No UI guard on save/apply for "all" (copy/export do guard).
- No optimistic/row versioning → concurrent editors of same branch+week silently overwrite (last-write-wins) until locked.
- Invalid times silently coerced to 08:00/16:00 in storage (console.warn only).
- Friday (week starts Saturday, index===6) hardcoded as the off day in apply-profile helpers.
