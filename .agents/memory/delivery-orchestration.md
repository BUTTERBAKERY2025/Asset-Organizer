---
name: Delivery orchestration boundaries
description: Why driver proof and source stock receipt are separate approvals.
---

Driver delivery tasks orchestrate existing kitchen orders and material transfers; they must never become a second stock-writing pipeline. Signature capture by a driver is pending proof, not authenticated receipt.

**Why:** Kitchen receipt has real/shadow inventory, allocations and unmet-demand semantics; warehouse receipt has its own atomic transfer ledger. Reimplementing either in a generic driver action risks double posting and bypassing destination authority.

**How to apply:** Preserve the original source receipt transaction and authenticated recipient. Approve the proof only after source receipt, bound to that actual receiver; then permit the assigned driver to close delivery. A signature or typed receiver name alone must not impersonate a branch manager. Other source types need explicit adapters, not arbitrary IDs.