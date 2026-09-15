---
name: Daily challenge preview scope
description: Why progress is a read-only per-journal estimate rather than an accrued daily points total
---

Keep daily challenge progress estimates separate from awarded points; do not invoke incentive posting while loading the portal.

**Why:** Approval currently replaces the cashier/branch/day challenge ledger when a journal is calculated. Multiple shift estimates therefore cannot be summed as a guaranteed daily award. Changing this needs an explicit accounting lifecycle decision, not a portal display change.

**How to apply:** Label previews as per-journal estimates and avoid a daily total until multi-shift approval semantics are resolved. The requested freshness is on opening the page/tab, not continuous streaming.