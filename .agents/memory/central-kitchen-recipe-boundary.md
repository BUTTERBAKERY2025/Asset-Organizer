---
name: Central kitchen recipe activation boundary
description: Recipe approval is configuration, not authorization to start automatic raw-material posting.
---

Recipe entry and approval are deliberately separate from consuming ingredients during production. Approval alone must never retroactively deduct material stock or alter existing production batches.

**Why:** The user first validated finished-output/request movements, then requested a recipe entry and approval screen because no approved formulas existed. Defining formulas is not equivalent to approving a stock-posting migration.

**How to apply:** Future consumption must explicitly connect a frozen approved recipe revision to a new production batch, account for stock precision and catalog units without guessed conversions, and debit the kitchen's own material balance—not the main warehouse.

Operation idempotency binds the requested source resource, while its stored response may describe a different created resource.

**Why:** Revising an approved recipe produces a new draft ID; binding replay to the result ID rather than the source ID incorrectly rejects identical retries.

**How to apply:** Preserve the original operation response independently of editable recipe records. Test replay after edits, approval, and draft deletion, including access loss for the original actor.