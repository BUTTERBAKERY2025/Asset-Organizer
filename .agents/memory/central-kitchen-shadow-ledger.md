---
name: Central-kitchen shadow ledger
description: Safety and allocation rules for projected inventory before real stock posting is enabled.
---

The central-kitchen inventory phase begins as an immutable shadow ledger. Its database activation timestamp is the boundary: orders created earlier are never backfilled, and shadow rows must never update real inventory balances.

The user subsequently authorized real inventory and production integration, with a **separate kitchen branch material balance** supplied by warehouse transfers first. Never debit the main warehouse directly for kitchen orders.

**Why:** The kitchen is an independently stocked operating location. Shadow-only was an earlier pilot choice, not a permanent prohibition on implementing real movements.

**How to apply:** Real-mode activation applies prospectively to new orders; legacy shadow orders remain unchanged. Reuse existing branch material and finished-product balances, and do not invent recipe-based material consumption without recipes/conversion data.

When one order line contains original and substitute quantities, projected dispatch and good receipt quantities allocate to the original component first, then to the substitute component.

**Why:** Existing inventory models use inconsistent identities and integer/free-text units. Shadowing exposes mapping gaps without corrupting stock, while deterministic splitting keeps retries and future comparisons stable.

**How to apply:** Preserve the activation boundary and original-first rule in reports and any later conversion to real movements. Damaged and missing quantities are never projected as branch inventory received.

Catalog linkage must preserve both prepared-product and warehouse-material identities without interpreting equal numeric IDs as the same item. Do not infer historical mappings from names.

**Compatibility:** Never return warehouse IDs through the legacy product-only catalog contract. Old open browser tabs interpret every numeric ID as a product; mixed catalogs require an explicitly versioned, source-validated contract.

**Why:** The pilot covers prepared products as well as warehouse materials; switching wholesale to either catalog would exclude valid requests. Linking a catalog is separate from enabling real stock posting.

**How to apply:** Keep source-specific identities through original/substitute allocations. Substitute quantities remain expressed in the requested unit by the established workflow, not automatically converted from catalog units. Immutable shadow rows cannot support FK `ON DELETE SET NULL`; use a deletion restriction for new catalog references.

For real stock, substitute catalog units must actually match the original stock unit; the pilot's label-only rule is not a conversion mechanism. Materials support up to six decimal places; finished-product counts remain whole. Reject unsupported precision instead of rounding.

**Why:** The user explicitly authorized fractional material inventory and recipe-driven production on 2026-09-12. This did not authorize inferred unit conversions or fractional finished-product counts. A permissive shadow allocation cannot safely become a real debit.

Production demand display and batch creation must use the same deterministic allocation of shared stock across approved real requests.

**Why:** Calculating each request against the entire free balance can make the dashboard suggest a production quantity that its own create endpoint rejects. Serialize production commitments at kitchen/product scope.

Runtime shadow applies only to new orders; paused blocks outstanding real movements. Existing real orders retain their snapshot semantics when new-order mode returns to shadow.

Historical completed production must not be credited again merely because a new idempotency marker is absent.

**Why:** Old posting logs predate modern batch markers. Treat finished legacy batches as already completed; explicit reposting needs durable evidence, never name-based inference or blind replay.