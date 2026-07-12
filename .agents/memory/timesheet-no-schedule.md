---
name: Timesheet day-status rules & metric parity
description: Unified day-status semantics (leave/no_schedule/day_off/absent) for timesheet reports and the backend/frontend parity rule for derived metrics.
---

Timesheet report generation must NOT invent a default schedule (e.g. 08:00–16:00 / 8h) or mark a day absent when the employee has no schedule entry, and approved leave days must never count as absent.

**Unified generator:** all three generation paths (single, bulk, branch-PDF) share ONE day-loop helper. Never re-add a per-route day loop — divergence between paths was the original source of accuracy bugs.

**Status priority (per day):** worked (check-in or present/late attendance) → present/late; else approved leave overlapping the date → `leave`; else off day → `day_off`; else explicit schedule → `absent`; else `no_schedule`.

**Rules:**
- `scheduledDays`/`absentDays` count ONLY real scheduled non-off, non-leave days. Approved leave excludes the day from both.
- Approved leaves come from `leave_requests` (status=approved) keyed by branchEmployeeId ONLY — UUID-only users without a linked branch employee have no leaves here. Fetch across ALL branches (transferred employees), filter per employee.
- Totals count `leaveDays` and `offDays` by STATUS, not by the `isOff` flag — a leave day falling on a rest day has `isOff=true` but must count as leave, not off (double-count bug caught in review).
- PDFs/status maps: leave & no_schedule & off days show "-" (not "غ") for missing check-in/out; every Arabic status map must include `leave` or it renders raw key.

**Why:** faked schedules/absences fed payroll-style absence deductions; the financial-impact endpoint reuses stored `totalAbsentDays`, so deductions auto-correct once totals exclude leave/no_schedule days.

**Parity rule (must stay in sync):** any metric derived on the frontend from report entries must use the SAME predicate the backend uses for its stored totals (e.g. late = `status === "late"`, never `lateMinutes > 0`).
