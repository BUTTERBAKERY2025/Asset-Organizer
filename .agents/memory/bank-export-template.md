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

**Formatting/orientation (2nd approved template, formatted version):**
- Export uses `xlsx-js-style` (NOT plain `xlsx`) so cell colors/fonts/borders are
  written. Plain `xlsx` silently drops styles.
- Sheet1 is **LTR** (`rightToLeft=0`), NOT RTL — the approved template is
  left-to-right even though content is Arabic. User phrased it "من الشمال لليمين".
- Colors: dark green `#287A51` (white bold font) for header rows; light green
  `#E2EFDA` (black bold) for the salary-component header cells only (cols G:J =
  الراتب الأساسي/بدل السكن/دخل آخر/الخصومات). Light green = Office accent6 (70AD47)
  tint 0.8.
- Two formulas are part of the template and must be emitted (not static values):
  `E2 = LEFT(D2,3)` (branch from financing account) and per-row إجمالي المبلغ
  `F = SUM(G:I)-J`.
- SN is zero-padded 4-digit text (`0001`); SN/iqama/account/SWIFT are text
  (`numFmt:"@"` + String()) to keep leading zeros / avoid scientific notation.

**Other durable decisions:**
- Company header block is FIXED constants (agreement P0023453, financing acct,
  branch 506, establishment numbers, RIBL, SAR) — confirmed by user.
- رمز البنك (SWIFT) is derived from the employee's free-text bank name via a
  keyword map; unmatched => left blank for manual fill in Excel (by design).
- Rows without a bank account number are excluded from the file (matches existing
  `missing_bank` payroll semantics); user is toasted exported/excluded counts.
- Housing/other split needs `housingAllowance` passthrough on the salary line
  (other income = allowances - housing). Requires manual prod redeploy.
