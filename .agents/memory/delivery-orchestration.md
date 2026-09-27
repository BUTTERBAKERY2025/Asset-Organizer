---
name: Delivery orchestration boundaries
description: Why driver proof and source stock receipt are separate approvals.
---

Driver delivery tasks orchestrate authoritative source shipments; they must never become a second stock-writing pipeline. Signature capture by a driver is pending proof, not authenticated receipt.

**Why:** Kitchen receipt has real/shadow inventory, allocations and unmet-demand semantics; warehouse receipt has its own atomic transfer ledger. Reimplementing either in a generic driver action risks double posting and bypassing destination authority.

**How to apply:** Preserve the original source receipt transaction and authenticated recipient. Approve the proof only after source receipt, bound to that actual receiver; then permit the assigned driver to close delivery. A signature or typed receiver name alone must not impersonate a branch manager. Other source types need explicit adapters, not arbitrary IDs.

Cancelling a delivery task cancels the driver's assignment, not the physical shipment. It must never refund dispatched stock automatically, and is forbidden once the source has actually been received. An unreceived cancelled task can be reassigned with its history retained.

**Why:** The user requested independent task cancellation and recovery from failed delivery. Conflating task cancellation with a return would create stock that has not physically returned.

**How to apply:** Keep source cancellation/return authorization separate, explain this distinction in the cancellation UI, and recheck source receipt under lock before task cancellation or reassignment.

Use a native anchor for source-receipt links that must open a new tab while retaining the delivery task.

**Why:** The project's router Link intercepted a receipt link despite target="_blank", navigating the existing tab instead. Browser verification confirmed a native anchor preserves both tabs. With rel="noopener", browser-test popup detection must not require an opener reference.

**How to apply:** Keep normal in-app navigation unchanged; use native new-tab links specifically for the source-receipt/return-to-approval workflow.

When source stock operations and delivery metadata share a transaction, lock the source before the assignment, consistently across dispatch, handover, reassignment and cancellation.

**Why:** Source dispatch and driver actions enter from opposite modules; reversing the lock order between them creates a deadlock risk. Acknowledgement must bind the actual shipment, including substitute identity, not only a total quantity.

**How to apply:** Reuse the shared source fingerprint and transactional dispatch guard. Late proof after authenticated source receipt is metadata recovery, not permission to repeat receipt or stock posting.

Treat delivery notification event constraints as part of the core assignment deployment contract.

**Why:** Notifications are enqueued inside the assignment transaction. A production CHECK constraint that excludes a newly introduced event type rolls back the entire assignment, not just its notification. Table existence alone does not prove schema readiness.

**How to apply:** Verify allowed event values as well as handover columns before enabling new delivery flows. Never swallow enqueue failures to make assignment appear successful. Build the response inside the transaction so a projection failure cannot report failure after a successful commit; inspect persisted assignments before advising retries.

External carriers are a transport mode, not fake driver accounts or a second inventory pipeline. Use documented carrier handover in place of the internal driver's acknowledgement, never in place of authenticated destination receipt.

**Why:** The user wants a single simple shipping workspace with automatic source data, not repeated forms, separate shipping modules or multiple windows. Carrier tracking and a typed receiver name do not prove branch acceptance.

**How to apply:** Keep source stock operations authoritative, evidence private and assignment-bound, and the next action in the existing detail view. When one UI action performs source dispatch followed by delivery tracking, refresh the authoritative state before retrying so a tracking failure cannot repeat dispatch. Do not silently resolve stock loss through a carrier exception note.

Shipping reports must distinguish physical source dispatch from delivery tracking start.

**Why:** The combined send-and-track action can dispatch successfully while tracking fails and resumes later. Using tracking start in a dispatch-date report moves a real shipment into the wrong period.

**How to apply:** Use the original source's dispatch timestamp for the dispatch filter and column. If it is absent, show no date rather than substituting creation or tracking time. Interpret report date boundaries in Saudi time consistently with displayed/exported timestamps.