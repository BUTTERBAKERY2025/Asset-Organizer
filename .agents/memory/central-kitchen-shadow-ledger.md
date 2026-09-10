---
name: Central-kitchen shadow ledger
description: Safety and allocation rules for projected inventory before real stock posting is enabled.
---

The central-kitchen inventory phase begins as an immutable shadow ledger. Its database activation timestamp is the boundary: orders created earlier are never backfilled, and shadow rows must never update real inventory balances.

When one order line contains original and substitute quantities, projected dispatch and good receipt quantities allocate to the original component first, then to the substitute component.

**Why:** Existing inventory models use inconsistent identities and integer/free-text units. Shadowing exposes mapping gaps without corrupting stock, while deterministic splitting keeps retries and future comparisons stable.

**How to apply:** Preserve the activation boundary and original-first rule in reports and any later conversion to real movements. Damaged and missing quantities are never projected as branch inventory received.

Catalog linkage must preserve both prepared-product and warehouse-material identities without interpreting equal numeric IDs as the same item. Do not infer historical mappings from names.

**Why:** The pilot covers prepared products as well as warehouse materials; switching wholesale to either catalog would exclude valid requests. Linking a catalog is separate from enabling real stock posting.

**How to apply:** Keep source-specific identities through original/substitute allocations. Substitute quantities remain expressed in the requested unit by the established workflow, not automatically converted from catalog units. Immutable shadow rows cannot support FK `ON DELETE SET NULL`; use a deletion restriction for new catalog references.