---
name: Timesheet duplicate prevention
description: Why the timesheet_reports unique index keys on version, and how dual-identity duplicate generation is blocked.
---

# Timesheet report duplicate prevention

## The unique index keys on `version`, not on an "active/non-superseded" flag
The unique index on `timesheet_reports` is `(employee_id, start_date, end_date, version)`.

**Why:** A partial unique index `WHERE superseded_by IS NULL` would seem cleaner (one active report per period) but it BREAKS reissue. The reissue flow inserts the NEW version row (with `superseded_by = NULL`) BEFORE it updates the OLD row to set `superseded_by`. For that moment both rows are non-superseded, so a partial-active unique index throws 23505 during reissue. Postgres unique indexes are not deferrable, so the in-transaction window can't be ignored.

Keying on `version` avoids this: generate always creates `version = 1`, so two concurrent generates collide (good); reissue creates `version = 2, 3, …`, which never collides.

**How to apply:** If you ever want a stricter "only one active report per period" DB guarantee, you must reorder reissue to never hold two non-superseded rows at once, or use a DEFERRABLE unique constraint — don't just swap the index condition.

## Cross-identity duplicates are blocked at the app layer, not the DB
An employee can be referenced by two identity forms: UUID (`employee_id`) or `branch_emp_N` (resolved to numeric `branch_employee_id`). The DB unique index keys on `employee_id` string only, so it canNOT prevent a UUID-report and a branch_emp_N-report for the same person/period from coexisting.

That gap is closed in the generate routes by `storage.getTimesheetReportForPeriodByAnyIdentity(employeeId, branchEmployeeId, ...)`, which matches `(employee_id = X OR branch_employee_id = Y)` for the period, ordered by `version DESC` (returns the latest version so `isLocked` reflects the active one). Both single and bulk generate resolve the numeric identity BEFORE this pre-check.

**Why:** mirrors the same dual-identity rule used across attendance/scheduling (canonical identity = `branchEmployeeId`). Filtering schedules/attendance by exact `employee_id` only caused employees stored under the other form to be counted absent all month.

## Generate routes catch 23505
Both generate routes catch Postgres `23505` (unique violation) as the race safety-net: single returns HTTP 409 "يوجد تقرير مسبق لهذه الفترة"; bulk pushes the employee to `skipped: already_exists` instead of `failed`.
