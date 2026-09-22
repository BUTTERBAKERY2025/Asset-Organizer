---
name: Financial aggregate precision
description: Prevent single-precision SQL sums from changing journal totals before rounding.
---

For financial verification on PostgreSQL `real` columns, promote each input before aggregation: `SUM(amount::numeric)`, not `SUM(amount)::numeric`.

**Why:** A live cashier-journal audit produced different totals from the same rows because `SUM(real)` accumulated at single precision. Casting or rounding the result afterward could not recover the lost cents.

**How to apply:** Use promoted inputs for preflight totals, scope confirmation, and before/after financial reconciliation. Do not mistake an aggregate precision difference for changed individual journal amounts.