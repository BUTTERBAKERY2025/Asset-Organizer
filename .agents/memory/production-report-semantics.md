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

Receipt discrepancies require authoritative settlement status; historical damaged/missing quantities do not establish whether a discrepancy remains open.

**Why:** A resolved discrepancy retains its original quantities. Conversely, a received list row can omit quantities while its discrepancy remains open.

**How to apply:** Use explicit open/resolved/none status for next-step guidance. If a report does not carry that status, direct the user to the source order and label settlement state unavailable rather than completed or unresolved.

Daily workplan evidence is not a stock-readiness or reconciliation verdict.

**Why:** A missing current recipe does not block fulfillment from existing stock or invalidate a historical frozen recipe. A material movement proves a recorded movement, not complete snapshot reconciliation. Selecting a future plan date does not make earlier future requests overdue.

**How to apply:** Keep recipe availability informational unless production need is established; label movement presence as evidence, preserve unknown allocation readiness, and compare lateness to actual Riyadh today. Selected dates organize current persisted state, not historical as-of snapshots.

Preparation provenance is not extra production and is not the source composition of dispatched or received quantities.

**Why:** Mixed historical groups can contain both classified and unclassified preparations. Summing just known source values falsely presents a partial amount as the complete source total.

**How to apply:** Only show numeric grouped source totals when every item is classified; otherwise show partial/unknown with null amounts. Preserve genuine recorded zero. Render only persisted proof references, and test against the writer's decimal-string quantities rather than invented numeric fixtures. Keep source quantities out of production summary totals.