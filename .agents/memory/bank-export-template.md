---
name: Bank salary export (Riyad Bank / مدد)
description: Non-obvious contract of the approved Riyad Bank WPS Excel template used by salary-closing export
---

# Riyad Bank (مدد/WPS) salary Excel export

The salary-closing page exports an .xlsx that must match an approved Riyad Bank
template. Two values look "wrong" but are intentionally matched to the template's
actual data rows — do NOT "fix" them to the data-sheet tokens:

- Employee status column (الحالة) = Arabic `"نشط"`, even though the reference
  `data` sheet lists `active`/`inactive`. The template's prefilled rows use `نشط`.
- Due date (تاريخ الإستحقاق) is emitted as `DD/MM/YYYY` (slashes), even though the
  header label literally says `(DDMMYYYY)`. The approved sample value was
  `05/02/2026`.

**Why:** user requirement is "match the approved template exactly"; the template
file itself is inconsistent (data sheet is only a dropdown reference, not the row
format).

**Other durable decisions:**
- Company header block is FIXED constants (agreement P0023453, financing acct,
  branch 506, establishment numbers, RIBL, SAR) — confirmed by user.
- رمز البنك (SWIFT) is derived from the employee's free-text bank name via a
  keyword map; unmatched => left blank for manual fill in Excel (by design).
- Rows without a bank account number are excluded from the file (matches existing
  `missing_bank` payroll semantics); user is toasted exported/excluded counts.
- Housing/other split needs `housingAllowance` passthrough on the salary line
  (other income = allowances - housing). Requires manual prod redeploy.
