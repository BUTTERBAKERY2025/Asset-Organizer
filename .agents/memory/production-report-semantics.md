---
name: Production reporting semantics
description: Authoritative report sources, comparable cohorts, and limits on historical linkage.
---

Report finished batches as actual production; inventory posting logs are evidence of posting, never a second production quantity.

**Why:** Adding batch and posting quantities counts the same output twice. Missing modern posting evidence on legacy batches is unknown coverage, not proof of missing stock.

**How to apply:** Preserve explicit linked/non-recipe/unknown coverage; do not infer historical consumption from an approved recipe or today's inventory.

Advanced production plans and finished batches are not comparable without an explicit order-item link. Count each range-plan item once, not once per overlapping day or authorized endpoint branch.

**Why:** A seven-day A→B plan can otherwise multiply when reporting both branches. Product names/current units do not establish that a batch fulfilled an order.

**How to apply:** Keep advanced-plan completion unavailable until explicit linkage exists. Central-kitchen order-item batch links do support comparison; their report uses the request cohort, even when linked production occurs on a different day.

Keep real, shadow, and unknown kitchen modes separate in headline quantities as well as detail rows. Historical material cost is unavailable without a frozen valuation.

**Why:** Shadow movements did not change physical stock; current catalog prices cannot establish historical production cost.

**How to apply:** Use mode-specific quantities, approved waste separately, and documented date/source definitions. Do not silently replace missing values with zero.