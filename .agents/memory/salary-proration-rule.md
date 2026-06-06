---
name: Salary closing proration rule
description: How salary-closing computes payable vs deducted days (business rule confirmed by user)
---

# Salary closing proration rule

Pay is prorated by ACTUAL attendance, NOT a flat gross.

- **Payable days** = present + weekly rest (isOff) + PAID leave.
- **Deducted days** = every other day in the month: absent, missing/unscheduled, and UNPAID leave.
- **dailyRate = gross / 30** (fixed denominator, never the month's real day count).
- `absenceDeduction = round2(deductedDays * dailyRate)`; `net = max(0, gross - insurance - absenceDeduction - manualDeductions)`.
- **Only days up to today** are considered for the current (unelapsed) month — no deduction for future days. Elapsed months count the whole month.
- **Paid leave types** = every leaveType EXCEPT `"unpaid"` (annual/sick/emergency/maternity/paternity/hajj/marriage/bereavement/other are all paid salary-wise).
- Per-day precedence when classifying: PRESENT > LEAVE(paid/unpaid) > WEEKLY_REST > UNPAID(absent/missing).
- Salary preview must NOT mutate the annual-leave balance — the leave module owns balance; payroll only DISPLAYS type + paid/deducted.

**Why:** Before this, employees who attended only ~half the month still received full gross. User demands extreme payroll precision and confirmed this exact model.

## Social insurance (GOSI) is record-only, never auto-computed
Salary closing takes `socialInsurance` STRICTLY from the employee record's `socialInsuranceDeduction` field. It must NOT auto-calculate GOSI (e.g. 9.75% of base+housing) when the stored value is 0 — not even for Saudis.

**Why:** Production data has `social_insurance_deduction = 0` for ALL active employees (Saudis included). The old auto-compute fabricated a ~9.75% deduction for every Saudi, producing wrong net totals. User requires the sheet to mirror each employee's actual record exactly. GOSI enrollment varies per person, so only HR-entered values are trustworthy.
**How to apply:** Gross = salary + (housing+transport+food+other) per employee. Insurance = stored value as-is. `onboarding-routes.ts` may still default new Saudi hires to 9.75% when creating the profile (editable) — that sets the record, which is fine; the closing just reflects whatever the record holds. `storage.ts` salary-management path already follows this (stored value, no fabrication).

**How to apply (day fields):** Any change to closure-line day fields (present/absent/off/paidLeave/unpaidLeave/unpaidDays/leaveBreakdown) must stay in lockstep across the calc engine, the close-route persistence payload, the locked-snapshot read mapping, and the salaryClosureLines schema — or locked snapshots silently lose data.
