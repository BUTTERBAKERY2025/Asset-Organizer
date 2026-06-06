---
name: Timesheet no-schedule accuracy & metric parity
description: How unscheduled days are handled in timesheet reports and the backend/frontend parity rule for derived metrics.
---

Timesheet report generation must NOT invent a default schedule (e.g. 08:00–16:00 / 8h) or mark a day absent when the employee has no schedule entry for that day.

**Rule:**
- A day with no schedule and no attendance (and not the weekly off) → status `no_schedule`. It is NOT counted as absent and contributes 0 scheduled hours.
- A day with attendance but no schedule → counts as worked (present/late), schedule columns shown as "—".
- `scheduledDays` and `absent` totals count ONLY days that have a real schedule (and are not off).

**Why:** Previously unscheduled days were faked as 08:00–16:00/8h/absent, producing false absences that fed into payroll-style absence deductions. Real branches don't schedule every employee every day.

**Parity rule (must stay in sync):** any metric derived on the frontend from report entries must use the SAME predicate the backend uses for its stored totals. Specifically, late-day counts use `status === "late"` on BOTH sides — do NOT use `lateMinutes > 0` on the frontend, it diverges from the backend total.

**How to apply:** the no-schedule logic lives in all timesheet day-loop generators (single, bulk, branch-pdf) plus the single-PDF entry mapping in pdf-generator. The financial-impact endpoint reuses `totalAbsentDays`, so its absence deduction is automatically correct once totals exclude no_schedule days.
