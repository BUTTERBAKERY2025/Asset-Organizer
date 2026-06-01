---
name: Timesheet report → employee linkage
description: How timesheet_reports rows are tied to a person; why portal scoping must use employeeId not branchEmployeeId
---

Timesheet reports are linked to a person via the **varchar `employeeId`** column, NOT `branchEmployeeId`.

**Why:** `createTimesheetReport` in the generate / generate-bulk routes does NOT set `branchEmployeeId` (it stays null). `employeeId` holds either the user's auth UUID (for account-linked employees) or the string `branch_emp_<id>` (for accountless employees).

**How to apply:** Any self-service / portal feature that must show "my own" timesheet reports must scope by `employeeId IN [userId, "branch_emp_" + emp.id]` and perform record-level ownership checks the same way. Do not rely on `branchEmployeeId` for timesheet ownership — it is usually null.

Related: status is a plain varchar (not a DB enum), so adding a new status value like `rejected` needs no DB migration — only update the TS enum/labels. Rejection reason is stored in the existing `notes` column.
