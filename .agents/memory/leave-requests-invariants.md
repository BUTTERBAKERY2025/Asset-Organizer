---
name: Leave requests invariants
description: Non-obvious correctness/security rules for the leave-requests + leave-balances feature.
---

- **Balance "used" must be computed by year-overlap, not by startDate.** `getLeaveBalanceSummary` (server/leave-helpers.ts) sums only the calendar days of each approved leave that fall *inside* the requested year. A leave spanning Dec→Jan is split across both years.
  **Why:** counting by `startDate` charged the whole cross-year leave to the start year, corrupting next-year remaining/approval checks.

- **Create routes must override server-controlled state — `createInsertSchema` includes every non-omitted column.** `insertLeaveRequestSchema` only omits id/createdAt/updatedAt/reviewedBy/reviewedAt, so a client can send `status`, `currentLevel`, `requiredLevels`, `approvalFlow`, `cancel*`. The HR create route (server/hr-routes.ts) force-sets `status:"pending"`, `currentLevel:1`, `approvalFlow:[]`, clamps `requiredLevels` to 1..3, and nulls cancel fields. Apply the same pattern to any new write path.
  **Why:** otherwise an `hr_leaves` user could create pre-approved / pre-advanced requests, bypassing the balance check + approval chain.

- **Attendance sync/reversal on approve/cancel/delete is intentionally non-blocking + idempotent.** It uses a notes marker `__leave:<id>`; failures are logged, not thrown.
  **Why:** payroll/salary reads leave from `leave_requests` directly (not attendance), so attendance is non-authoritative; failing a manager's approval/cancel because of a transient attendance write would be worse, and re-running self-heals via the marker.

- **Unpaid leave (`leaveType === "unpaid"`) is fully decoupled from leave balance.** `getLeaveBalanceSummary` early-returns all-zeros for unpaid (no entitlement/used/remaining); the approval `balance_exceeded` check exempts unpaid; the three `/api/hr/leave-balances*` management endpoints reject `type=unpaid` with HTTP 400; the create-form balance card and the balances-tab type selector hide/skip unpaid.
  **Why:** unpaid leave has no entitlement, so it must never consume or be limited by a balance — but salary still deducts unpaid days separately from `leave_requests` (do not confuse the two).

- **apiRequest throws a plain `Error` with message `"<status>: <body>"` — no `.data`.** To detect a structured server error (e.g. 409 `balance_exceeded`) on the client, slice the JSON out of `error.message` and parse it (see leaves.tsx review onError). Do not expect `error.data`.

- **Leave-balance writes never trust client branchId.** `/api/hr/leave-balances` parses with `.omit({branchId:true})` and always derives/syncs branchId from the employee record (covers transfers).
  **Why:** the schema's notNull branchId made the create path 400 when the client omitted it, and accepting it from the client would allow branch spoofing.

- **Carryover (ترحيل الأرصدة) is overwrite-idempotent, transactional, and tag-stripped.** It recomputes prev-year remaining and overwrites `carriedOverDays` (skip-if-equal), runs all writes in one `db.transaction`, and strips any previous "ترحيل تلقائي من ..." segment from `note` before appending.
  **Why:** append-only notes bloat on reruns; non-transactional bulk HR writes leave partial state on mid-run failure.

- **"Today" for leave movement classification must be Asia/Riyadh, not UTC.** Stats endpoint computes `today` via `toLocaleDateString("en-CA",{timeZone:"Asia/Riyadh"})`.
  **Why:** UTC misclassifies في إجازة الآن/سيغادر/سيعود for ~3 hours around midnight KSA.

- **Working-days must be computed via `computeLeaveDaysWithHolidays` (async) in every leave create/edit path.** It excludes Fridays AND active `public_holidays` ranges without double-counting. Never reintroduce the sync `computeLeaveDays` in a write path.
  **Why:** a path using the old sync helper silently ignores holidays → over-deducts balances.

- **Sick-tier breakdown (Art. 117: 30 full / 60 @¾ / rest unpaid) counts *calendar* days per calendar year, clips cross-year ranges, and excludes the request itself (`excludeId`) when recomputing at approval.** Persisted to `leave_requests.sick_tier_breakdown` only on FINAL approval; preview endpoint must branch-scope the target employee.
  **Why:** without excludeId, re-review double-counts the request's own days; tiers reset per calendar year by law.

- **Return-reminder dedupe is DB-enforced**: partial unique index `uq_notification_queue_return_reminder` on (related_module, related_entity_id, channel) WHERE related_module='leave_return_reminder', + `onConflictDoNothing()`. In-memory once-per-day gate is only an optimization.
  **Why:** check-then-insert alone is a TOCTOU race under concurrent ticks/instances.

- **Dev/prod DB drift trap:** `notification_queue.media_url` existed in the Drizzle schema but not in the DB — every drizzle insert into that table failed with an opaque "Failed query". If a drizzle insert fails but raw SQL works, diff schema columns vs information_schema first.
