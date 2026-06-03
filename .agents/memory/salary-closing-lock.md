---
name: Salary closing snapshot & month lock
description: Constraints for the monthly salary-closing immutable snapshot + lock feature.
---

# Salary closing: snapshot + month lock

- A closed month must behave as an **immutable snapshot**. The preview endpoint must return the SAVED snapshot (salary_closure_lines + header totals/warnings), NOT a live recompute, whenever status==='closed'. Live recompute on a locked month silently lets numbers drift away from payslips/bank-file.
  **Why:** payslip PDF and bank file read saved lines; on-screen and report exports must match them.

- There is a UNIQUE index on (branch_id, month). After a reopen, re-closing must **reuse the existing row** (update header + delete/reinsert lines transactionally), never insert — else duplicate-key (23505).

- Month-lock must be enforced server-side on EVERY mutation that feeds the snapshot: salary-deductions POST/PUT/DELETE and salary-closing/link-attendance all return 423 when the branch+month closure is closed. Client UI disabling alone is not enough.
  **Gotcha:** attendance_records date column is `attendanceDate` (not `date`); deriving the month from the wrong field silently skips the lock.

- Snapshot lines store combined `absentDates` only. The dashboard table popovers expect `absentDatesExplicit`/`absentDatesMissing`; the server calc must emit both, and locked-preview mapping sets explicit=absentDates, missing=[] to avoid popover crashes.

- Known accepted gap: lock check + mutation are TOCTOU (not atomic). Acceptable at this team's scale; revisit with advisory/row locks if concurrent close+mutation becomes a real problem.

## Attendance↔employee name matching (Excel imports)

- `computeSalaryClosing`'s `normalizeName` folds Arabic variants (أإآٱ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي), strips tashkeel/tatweel, and removes ALL spaces (so "عبد الله"="عبدالله"). Applied to BOTH the employee nameLookup build and record matching.
  **Why:** Excel attendance rows are per-DAY; one unmatched person = ~26 unlinked rows. Strict matching left many unlinked.

- CRITICAL: stronger name folding raises collision risk. `nameLookup` must map normalized-name → **array** of employee ids, and auto-match by name only when the array length is exactly 1 (`matchByName`). Many-to-one name maps silently mislink salary to the wrong employee.
  **How to apply:** any future loosening of name matching must keep the "unique match only" guard, otherwise payroll is silently wrong.

- Client grouped link dialog suggestions carry a confidence: "high" = exact employeeNumber or unique exact normalized full-name (safe for one-click mass link "ربط المطابقات المؤكدة"); "low" = token-overlap heuristic (per-group manual review only, excluded from mass link).
