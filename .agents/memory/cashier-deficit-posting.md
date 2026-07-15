---
name: Cashier deficit posting
description: Sign conventions and posting rules for cashier sales-journal deficits → salary deductions
---

- `cashier_sales_journals.discrepancyAmount` is stored as an ABSOLUTE value; direction comes from `discrepancyStatus` (shortage/surplus). Never use `Math.min(0, …)` sign logic on it — shortage would compute to 0.
- `netDiscrepancy` column exists but nothing writes it from the journal form (usually 0); treat it as optional override, fallback to `discrepancyAmount`, and subtract `inputErrorAmount` when `isInputError` (input errors are not charged to the cashier). Bank side: `bankDiscrepancyTotal` + `bankDiscrepancyStatus` same absolute convention.
- Posting a deficit = one `salary_deductions` row (type `sales_deficit`) per cashier/month; journals stamped with `deficit_deduction_id` (atomic guard IS NULL + SELECT FOR UPDATE) to block double-posting. Salary closing sums ALL deduction types by month, so no closing change needed.
- Cashier user → employee: `branch_employees.linked_user_id` can match multiple profiles; pick the profile matching the journals' branch first (then active) or the deduction lands on the wrong employee record.
