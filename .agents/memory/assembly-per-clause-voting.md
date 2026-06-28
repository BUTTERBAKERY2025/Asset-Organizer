---
name: Assembly per-clause voting
description: Invariants for per-clause (بنود) voting on assembly resolutions; what makes a resolution clause-based vs legacy single-vote.
---

# Assembly per-clause voting

A resolution is **clause-based** if it has rows in `assembly_resolution_items`; otherwise it keeps **legacy single-vote** behavior. The two modes must never mix for one resolution.

- **Strict mode**: the whole-resolution vote endpoint must reject (400) when the resolution has any clauses — shareholders must vote per-clause instead. The legacy dedup check must be scoped to `item_id IS NULL`.
- **Clause freeze**: admin add/edit/delete of a clause is blocked once any **per-clause** vote exists on the parent resolution — count by `resolutionId` AND `item_id IS NOT NULL`. This is still resolution-wide (a single per-clause vote freezes ALL clauses, preventing "vote on clause A then edit clause B" tampering), but **legacy whole-resolution votes (`item_id IS NULL`) do NOT freeze clauses**. **Why:** legacy resolutions (voted before per-clause existed) need descriptive clauses added afterward so the new per-clause printed minutes can list them, without re-voting. Do NOT revert this to "any vote freezes" — that breaks documenting old signed resolutions.
- **DB integrity**: two partial unique indexes guard duplicate votes — `(item_id, shareholder_id) WHERE item_id IS NOT NULL` and `(resolution_id, shareholder_id) WHERE item_id IS NULL`. Both vote endpoints must catch pg `23505` and return a friendly "already voted" 400.
- **Result semantics**: a clause result is recomputed live after each vote, share-weighted, using the *effective* majority `item.majorityType ?? resolution.majorityType ?? "simple"` (simple >50%, two_thirds ≥2/3, three_quarters ≥0.75). While voting is open it is only ever `approved` or `pending` — never a premature `rejected` (there is no close/finalize step yet).

**Why:** an architect review failed the first cut because mixed-mode voting, missing DB uniqueness, and per-clause-only freeze let the ballot be tampered with or double-counted.

**How to apply:** any new endpoint or admin action touching assembly resolutions must check clause existence first and respect the freeze/strict rules above. Prod (Supabase) needs the unique indexes created manually with a duplicate preflight before deploy.
