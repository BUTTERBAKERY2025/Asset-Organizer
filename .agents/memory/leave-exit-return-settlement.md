---
name: Leave exit/return/settlement lifecycle
description: Invariants for مباشرة الخروج/العمل and annual-leave تصفية (settlement)
---
# Leave lifecycle invariants

- **Auto-absence markers**: overdue-return absences use `notes = "__leave_overdue:<leaveId>"`, `status = "absent"` in `attendance_records` (distinct from on-leave marker `__leave:<id>` with `status = "on_leave"`). Never touch pre-existing attendance rows; both mark/clear helpers are idempotent. Cap = 180 days.
- **Return confirmation ordering**: attendance adjustments (mark late absences + clear from return date) MUST run BEFORE setting `actualReturnDate` on the leave. Once `actualReturnDate` is set the scheduler stops maintaining that leave, so a swallowed attendance failure would silently under/over-record absences.
  **Why:** scheduler filter is `actualReturnDate IS NULL`; helpers are idempotent so re-running after a failed request is safe.
- **Settlement rules**: annual + approved only; days ≤ remaining balance; amount = days × (grossSalary/divisor 21|30) unless manual override; `settledDays` upserted into `leave_balances`; cancel restores it. One active settlement per leave enforced by partial unique index `uq_leave_settlements_request_active` — route maps it to HTTP 409.
- **Drizzle unique-violation detection**: DrizzleQueryError does NOT put the constraint name in `e.message`; check `e.cause.constraint` / `e.cause.message` (pg error is wrapped in `cause`).
- **Exit/return apply to any approved leave type** (deliberate); settlement is annual-only.
- Prod (Supabase) SQL for these tables: `attached_assets/prod_sql_leaves_settlement_exit_return.sql` — must be run manually before Render deploy.
