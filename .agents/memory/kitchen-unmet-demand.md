---
name: Kitchen unmet-demand accounting
description: Operational commitments versus stock movements, branch consent, and uncertain legacy receipt attribution.
---

Track unmet original demand separately from inventory movements. Creating a replacement is an allocation, not fulfillment; only good receipt earns credit. Waiver closes a commitment administratively but must not improve service fulfillment.

**Why:** The user explicitly requires remaining demand to survive order completion and compensation not to duplicate inventory or inflate fulfillment.

**How to apply:** Keep original-demand identity across replacements, release cancelled allocations, and allow replanning after partial final receipt. Preserve real/shadow separation and exact fractional arithmetic.

Combined receipt quantities do not prove which original/substitute components arrived. Require authorized branch confirmation before settlement when attribution is estimated; never silently report the estimate as confirmed.

**Why:** Existing receiving captures combined good quantities. Inferring original-first cannot establish branch acceptance of a substitute.

**How to apply:** Preserve explicit consent for accepted substitutes and waivers. Replacement orders currently require the original item; lifting that restriction requires a replacement-substitute acceptance lifecycle, not automatic credit of combined receipt.