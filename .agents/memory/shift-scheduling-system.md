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

**Weekly-rest monthly cap (2026-07-12):** max 4 paid isOff days per employee per CALENDAR MONTH,
enforced server-side in `validateMonthlyWeeklyRestCap` on single/bulk POST + PATCH (400,
code WEEKLY_REST_CAP_EXCEEDED, Arabic message directing to نظام الإجازات). Counts existing month
rows by BOTH identity forms, incoming rows override existing per date; only enforced when the save
keeps/adds ≥1 off-day (so legacy over-cap months stay editable downward). Days inside APPROVED
leave_requests never count and render as locked amber "إجازة معتمدة" cells via bundle's
`approvedLeaves`; client save & copy-to-next-week skip leave-covered TARGET dates.

**Optimistic concurrency + local drafts:** bundle returns `scheduleVersion`
("count:maxId:maxUpdatedMs" over the week's rows); bulk save sends it as `baseline` and gets
409 SCHEDULE_CONFLICT if another user changed the week (client dialog: refresh/force/cancel;
`force:true` skips only this check, no privilege change). Unsaved grid edits also autosave to
localStorage (`shift-draft:{branch}:{weekStart}`, 7-day expiry, restore banner). **Limits:**
fingerprint check is non-transactional (TOCTOU window) and ms-precision on updatedAt — good
enough for human editing, not strict serialization.

**"All branches" mode is view-only by design (2026-07-12):** apply/copy/save buttons are
disabled + info banner when branch="all"; runtime toast guards remain as backstops.

**Rest-day selector scope (2026-07-12):** the rest-day choice in the "تطبيق على الجميع"
dialog applies ONLY to apply-to-all (default Friday, index 6 with Saturday week start).
**Why:** per-employee quick-apply intentionally stays fixed on Friday — sharing the dialog's
state silently changed individual applies (review-flagged UX ambiguity). Keep them decoupled.

**Still-open gaps (not yet fixed):**
- Invalid times silently coerced to 08:00/16:00 in storage (console.warn only).

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

**Attendance check-in REQUIRES a saved schedule (decision 2026-06-04).** Both self check-in
(`checkIn`) and clerk/biometric check-in (`checkInEmployee`) hard-block (400, Arabic) when no
`employee_schedules` row exists for that person+branch+date, AND when that day's row is `isOff`.
Applies to everyone (no admin override). Bulk historical import path is intentionally exempt.
**Why:** lateness was computed only if the client sent `scheduledStartTime`; missing/edited schedules
silently produced status='present' with no late-calc, and the server trusted client-supplied times.
**How to apply:** resolver `getScheduleForCheckIn(employeeId, branchId, date)` is the authoritative
source — it matches by employeeId string OR canonical branchEmployeeId, and MUST stay deterministic
(order by id DESC + prefer canonical branchEmployeeId) because dual-identity legacy rows can both match;
a naive `or(...)+limit(1)` could pick an isOff row and wrongly block a valid employee. The schedule's
startTime/endTime/id override any client-supplied values on the attendance record.

**Attendance identity & check-out edge cases.** A person can appear both as a user UUID and
as `branch_emp_<id>` (bridged by `branchEmployees.linkedUserId`); schedules AND attendance both
store either form. Therefore: (1) any per-person attendance lookup for a day must resolve BOTH
identity forms (helper `getAttendanceForAnyIdentityAndDate`) or you get duplicate records / a
check-out that can't find the open record. (2) Check-out UPDATEs must key on the STORED
`existing.employeeId`, never the caller-supplied id, or a cross-identity update silently no-ops.
(3) Schedule lookup for check-in (`getScheduleForCheckIn`) has a last-resort name fallback for
UNLINKED employees, but it MUST reject ambiguity: if a normalized name maps to >1 distinct
identity on the same branch+day, return undefined (block) rather than guess.
**Why:** prefer a false-negative (block, prompt to link identities) over false-positive
(attaching the wrong person's schedule/attendance). **How to apply:** keep working-hours
overnight-safe (`if diff<0 add 24h`) and times in HH:MM (`saudiTime.timeShort`) across BOTH
self and clerk paths so late/early-leave math stays consistent.
