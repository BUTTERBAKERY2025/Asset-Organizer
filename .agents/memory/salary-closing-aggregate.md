---
name: Salary-closing all-branches aggregate
description: Why the /salary-closing "all branches" view must stay read-only
---

The `/salary-closing` page supports an aggregate "كل الفروع" branch option that merges preview + payments across all branches the caller can access.

**Rule:** aggregate mode must be fully read-only — no closing, linking, deductions, attendance adjustment, bulk actions, or payment mark/unmark.

**Why:** in the locked-snapshot code path, a preview line's `id` is the closure-line id, NOT the branchEmployeeId. A single-branch view never mixes locked + unlocked lines, but the aggregate does, so any mutation control keyed on `emp.id` can target the wrong employee. The backend also forces `isLocked:false` for the aggregate, so lock-only UI gates do not protect it.

**How to apply:**
- Backend resolves accessible branches via `getAllowedBranchIds` then re-checks each with `canAccessBranch` (respects EVENT-BB); never trust a client branch list.
- Frontend: gate every mutation surface with `!isAllBranches` (not just `!salaryClosingIsLocked`). For any read-only display that needs an employee id (e.g. payment status), use `emp.branchEmployeeId` only — never `emp.id`.
