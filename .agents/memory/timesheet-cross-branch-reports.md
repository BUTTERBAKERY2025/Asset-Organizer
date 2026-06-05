---
name: Timesheet cross-branch reports
description: Why timesheet schedule/attendance sources are fetched across ALL branches, and the membership check that must accompany that broadening.
---

# Timesheet reports must aggregate across branches, but gate per-employee membership

When an employee is transferred between branches mid-month, the monthly timesheet
report must still show the days worked in the OLD branch. So the schedule and
attendance sources are fetched **across all branches** for the period
(`getEmployeeSchedulesByDateRange`, `getAllAttendanceRecords({startDate,endDate})`
with no branchId), then filtered per-employee by identity. A per-day "الفرع" (branch)
column is derived from each attendance row's `branchId`.

**Why:** branch-scoped fetches dropped transferred-employee days silently.

**How to apply / the trap:** broadening the data source removes the implicit
branch-isolation that branch-scoped queries gave you. Every report-generating path
must therefore independently enforce that the *target employee belongs to the
requested branch* BEFORE filtering, or a user with access to branch A can generate a
report for a branch-B-only employee and read B's attendance. The bulk endpoint
always had this check; the single `/api/timesheet-reports/generate` endpoint did NOT
and had to be brought in line. Membership rule (for both branch_emp_N and UUID-user
forms): the branch employee's `branchId` must equal the requested branchId, or the
user is a member of that branch / linked to a branch employee in it. A transferred
employee is now on the new branch's roster, so the check passes and their full
cross-branch history is included — that is the intended behavior.

Read-only enrich/PDF endpoints (`:id/entries`, `:id/generate-pdf`) only broaden the
fetch to derive the branch *label*; they already gate on report access, so no extra
membership check is needed there.
