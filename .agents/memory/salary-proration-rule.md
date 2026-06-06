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

**How to apply:** Any change to closure-line day fields (present/absent/off/paidLeave/unpaidLeave/unpaidDays/leaveBreakdown) must stay in lockstep across the calc engine, the close-route persistence payload, the locked-snapshot read mapping, and the salaryClosureLines schema — or locked snapshots silently lose data.
