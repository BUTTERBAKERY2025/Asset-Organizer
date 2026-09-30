---
name: Branch operations domain boundaries
description: Approved phased dashboard approach and avoiding false equivalence between existing modules.
---

Build the branch operational board as a composition of authoritative existing modules, not a second operational database. New domains require their own complete workflows before appearing as working dashboard sections.

The approved manager center extends this composition across explicitly granted branches. Its intervention inbox is a projection of source workflows, not a replacement approval or stock ledger. Unknown assignees and absent deadlines must remain unknown.

**Why:** On 2026-09-30 the user approved the seven-stage scope-first implementation, preserving HR/finance boundaries while adding live and periodic operational follow-up.

**How to apply:** Separate actual user assignment from role labels; link each queue item to its exact source record. Daily/weekly evidence is not a persisted historical snapshot, and live connection timestamps are not data freshness. Keep periodic refresh as recovery for process-local update hints.

**Why:** The user approved a familiar branch-staff entry point while explicitly requiring every piece of information to match the real system structure. Similar labels are not interchangeable: asset maintenance status is not a maintenance ticket, visitor logs are not supervisory visits, and cashier closing is not a cash-custody ledger.

**How to apply:** Verify domain semantics before reusing a source. Navigation-only cards are acceptable until trustworthy counters exist; never invent metrics or silently substitute a different workflow. Keep missing-domain development staged according to the branch operations roadmap.

Multi-source branch supply means a common entry into separate kitchen-order and main-warehouse material-transfer workflows, not treating the warehouse as a kitchen.

**Why:** The two suppliers use different catalog identities, approval responsibilities, and stock-posting times. A warehouse material listed in a kitchen order is supplied from kitchen-local stock; it is not permission to debit the main warehouse.

**How to apply:** Preserve the selected authorized branch across source changes, choose the kitchen explicitly, and keep each supplier's request and receipt records independent. A genuinely mixed basket requires explicit split-request linkage rather than silently combining inventory movements.

The approved branch desk is a daily-work surface, not a second system launcher. Keep administrative follow-up secondary and put actual next steps ahead of module shortcuts.

**Why:** The user approved reorganizing the board because repeated alerts, informational counts, and module links were presented as equally urgent. A recorded waste entry or an approved advance does not establish pending work; a missing closing today does not establish lateness without a real deadline.

**How to apply:** Separate status from action, use actual deadlines and actor authority, and distinguish a read-only follow-up link from permission to execute an operation. Do not invent shift coverage or daily target allocations to fill a dashboard section.

Do not merge dashboard alerts solely because they open the same destination.

**Why:** Different operational topics can share a page while representing different priorities, populations, or responsibilities. Combining their counts or hiding one can lose actionable work.

**How to apply:** Retain semantic identity when deduplicating. Verify destination query handling and authoritative action permissions before treating an apparently repeated link or supplier-specific policy as a defect.

Keep the board's top area in the existing system identity, without repeating lower-page metrics or expanding every follow-up by default.

**Why:** On 2026-09-25 the user rejected the separate warm visual identity and repeated nested headings/panels; requested simple notifications for work needing intervention and explicitly limited the redesign to the top.

**How to apply:** Keep alerts compact with details on demand; preserve access to distinct topics and partial-data warnings. Do not redesign the lower sections or introduce tabs without a new request.

The daily kitchen order workspace should compose existing delivery and branch/bar operations in place, not create a parallel lifecycle or collapse independent approvals.

**Why:** The user explicitly prioritized fewer windows and repeated inputs after a live order required repeated navigation and proof submissions. Faster interaction must preserve source stock postings, independent recipients, and per-record audit history.

**How to apply:** Put the actor's next permitted action first, show waiting ownership after success, and offer proof replacement explicitly rather than leaving an initial-send form open. Only batch actions with individually reviewed eligibility and separate idempotency/results. Pooled branch lots cannot prove that a specific order reached the bar; label that downstream view as shared context unless explicit provenance exists.

Differentiate kitchen operations presentation from branch requester presentation without treating the presentation choice as authorization.

**Why:** The user explicitly approved a daily operating workspace for production management and administrators, while branch staff should focus on requesting, tracking, and receiving rather than managing every kitchen.

**How to apply:** Keep operational detail beside the queue on desktop and preserve filtering/navigation context. Enforce actual actions through server capabilities and branch scope. Label any page-limited demand summary clearly; never imply it includes unseen pages or nets against stock.

Basic kitchen-order readers must be able to inspect the order without permissions for embedded production, recipes, delivery, or inventory.

**Why:** Users reported that inspecting ordinary order contents produced wider-module permission errors. Optional child queries were mounted even when the caller only needed order contents.

**How to apply:** Authorize basic order reads independently; gate optional child queries by both module permission and resource scope. A denied optional section must not block authorized order contents, while a denied base detail must hide the entire stale detail. Never grant wider module access merely to suppress those errors.