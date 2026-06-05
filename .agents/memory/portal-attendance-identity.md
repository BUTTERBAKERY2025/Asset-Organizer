---
name: Portal attendance identity matching
description: Why employee self-service attendance reads must match three identity forms, not one.
---

# Attendance reads must match ALL identity forms or manager records disappear

A `attendance_records` row for one person can be keyed three different ways:
- `employee_id = 'branch_emp_<branchEmployeeId>'` — written by the portal self check-in.
- `branch_employee_id = <id>` (integer FK) — set only when employeeId starts with `branch_emp_`.
- `employee_id = <linkedUserId UUID>` — written by the **manager** flow (shift page) which
  stores `employee.linkedUserId || 'branch_emp_<id>'`; UUID-keyed rows get a NULL branch_employee_id.

**Why:** matching by a single form (e.g. branch_employee_id only) silently hides
manager-entered attendance from the employee's بوابتي (today card, monthly list, overview
summary). This was a real audit bug.

**How to apply:**
- Use one shared matcher across every `/api/my` attendance read (overview, monthly, today):
  OR of the three forms. `linkedUserId` comes from `getMyEmployee()` (resolved via
  `branchEmployees.linkedUserId === session userId`), so matching that UUID is safe — it
  provably belongs to the logged-in employee and cannot leak another person's rows.
- Matching multiple forms can return 2 rows for the same day (portal + manager) → dedupe by
  `attendanceDate` keeping the highest `id` (most recent wins) before counting/listing.
- There is NO provenance column, so "who recorded this" is only a heuristic
  (`employeeId === branch_emp_<id>` ⇒ self). It can under-report manager records (false
  negative) but never fabricate a self/manager label — fine for a non-critical badge.

## The matcher must be symmetric across BOTH surfaces (read AND write/check-out)

**Why:** the portal READ matched all 3 forms incl. the numeric `branch_employee_id`
column, but storage's `getAttendanceForAnyIdentityAndDate` (used by check-in dup-guard +
check-out, and the aggregated branch page) matched ONLY by `employee_id` string. So a
checkout on the aggregated page closed one row while the portal read a different open row →
employee stuck "في الدوام". The same endpoint also mixed an exact-match pre-check with an
identity-aware update path → they could pick different rows.

**How to apply:** any code that finds "today's attendance for a person" — portal reads,
storage lookups, AND the aggregated `/api/attendance/check-out-employee` pre-check — must use
the SAME OR-of-all-forms matcher (string forms + numeric `branch_employee_id`), prefer the
OPEN row, else newest. Keep the 42703 missing-column fallback also matching all string forms.
Backfilling `branch_employee_id` for every row (from `branch_emp_<n>` and from
`linked_user_id`) makes the numeric column the canonical unifier and prevents future splits.
