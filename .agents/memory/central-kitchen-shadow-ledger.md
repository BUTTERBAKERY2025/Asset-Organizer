---
name: Central-kitchen shadow ledger
description: Safety and allocation rules for projected inventory before real stock posting is enabled.
---

The central-kitchen inventory phase begins as an immutable shadow ledger. Its database activation timestamp is the boundary: orders created earlier are never backfilled, and shadow rows must never update real inventory balances.

When one order line contains original and substitute quantities, projected dispatch and good receipt quantities allocate to the original component first, then to the substitute component.

**Why:** Existing inventory models use inconsistent identities and integer/free-text units. Shadowing exposes mapping gaps without corrupting stock, while deterministic splitting keeps retries and future comparisons stable.

**How to apply:** Preserve the activation boundary and original-first rule in reports and any later conversion to real movements. Damaged and missing quantities are never projected as branch inventory received.