---
name: External sales evidence
description: Distinguish analytical imports from stock-consumption evidence and duplicate business events.
---

External sales analytics are not an inventory sales ledger, even after exact-upload retry protection.

**Why:** The user selected external imports as the sales authority, but available analytical spreadsheets do not establish canonical units, invoice-line identity or refund reversal. Identical upload protection does not identify overlapping periods or reordered business events.

**How to apply:** Reuse the existing import path rather than assuming POS is the external source or creating a parallel importer. Do not derive remaining bar stock or historical consumption until mappings, opening balances, returns and source event identities are proven.

Without invoice-line identities, an overlapping import period must require explicit review rather than automatic merging. Exact retries compare a row multiset, not spreadsheet row order; repeated identical rows within one file remain distinct.

**Why:** A reordered export is the same upload, but a partly overlapping export cannot safely establish which sales are new. Silently deleting identical lines can also discard legitimate repeated sales.

**How to apply:** Preserve original imports and reject conflicting overlap until a separately approved replacement workflow exists. Freeze catalog product/unit evidence when accepting new comparison imports; historical name-only sales remain unmapped, not retroactively certified from today's catalog.