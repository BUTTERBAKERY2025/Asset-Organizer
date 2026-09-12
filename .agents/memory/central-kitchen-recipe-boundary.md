---
name: Central kitchen recipe activation boundary
description: Recipe approval is configuration, not authorization to start automatic raw-material posting.
---

Recipe entry and approval are deliberately separate from consuming ingredients during production. Approval alone must never retroactively deduct material stock or alter existing production batches.

**Why:** The user first validated finished-output/request movements, then requested a recipe entry and approval screen because no approved formulas existed. Defining formulas is not equivalent to approving a stock-posting migration.

**How to apply:** Consumption must explicitly connect a frozen approved recipe revision to a new production batch, account for stock precision and catalog units without guessed conversions, and debit the kitchen's own material balance—not the main warehouse.

The user authorized fractional material stock and the production link on 2026-09-12. This authorization remains prospective: do not attach recipes to old batches or recalculate their stock movements.

**Why:** Existing completed batches were already posted under the earlier workflow. Retroactive formula attachment risks double-crediting output or debiting materials that were not tracked then.

**How to apply:** Require an explicit recipe-backed new batch; legacy and shadow workflows retain their original semantics, including historical fractional shadow quantities. Validate finished-product whole counts only at the real-stock boundary, not in a mode-blind request schema.

When replacing historical REAL quantity carriers with exact decimals, use their canonical decimal text and reject genuinely excessive precision rather than rounding.

**Why:** Converting float binary expansions directly creates apparent overprecision in valid inputs; changing only stock tables leaves intermediate order/ledger quantities drifting.

**How to apply:** Trace the full material path (request, reservation, dispatch, receipt, audit) and preserve six-decimal quantities throughout. Keep production finished counts separate.

Operation idempotency binds the requested source resource, while its stored response may describe a different created resource.

**Why:** Revising an approved recipe produces a new draft ID; binding replay to the result ID rather than the source ID incorrectly rejects identical retries.

**How to apply:** Preserve the original operation response independently of editable recipe records. Test replay after edits, approval, and draft deletion, including access loss for the original actor.