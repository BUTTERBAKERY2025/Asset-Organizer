---
name: Timesheet dashboard employee modes
description: Active-only vs attendance-based employee lists on the timesheet dashboard, and why canGenerate must mirror generate-bulk.
---

The timesheet dashboard (`/timesheet`) has two employee-list modes for a selected branch+month:
- "active" (نشط فقط): active roster only — users in branch + branch_employees with status active & no linkedUserId.
- "attendance" (كل من له بصمة): union of roster + everyone with attendance_records in the month for that branch (includes inactive/transferred/terminated), via `GET /api/timesheet-reports/attendance-employees`.

**Rule:** report generation (single + generate-bulk) is gated by CURRENT branch membership server-side (branch_emp must have branchId===selectedBranch; user must be branch member or linked to a branch employee here). This is a security gate (prevents cross-branch data extraction) — do NOT weaken it.

**Why:** therefore an attendance-only row for a transferred-OUT employee (attendance.branchId===branch but their branch_employee.branchId now differs) is **viewable but not generatable**. The attendance-employees route returns a `canGenerate` flag computed by mirroring generate-bulk's exact allow-set. Inactive-but-same-branch employees ARE generatable (roster lookup includes all statuses).

**How to apply:** KPI `notGen` and bulk `missingIds` must only count `!report && canGenerate` rows, or the UI shows impossible "not generated" counts and bulk attempts that 403. Non-generatable rows render a "view only" note instead of a Generate button. Match reports to rows by employeeId OR branchEmployeeId (UUID vs branch_emp_N duality). Route is registered BEFORE `/api/timesheet-reports/:id` to avoid `:id` shadowing.
