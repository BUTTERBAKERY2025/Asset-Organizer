---
name: Kitchen responsibility and escalation policy
description: Why kitchen selection stays manual and operations notifications differ from intervention permissions.
---

Do not infer or configure a default kitchen, even when only one kitchen is available. Each new request requires an explicit kitchen choice.

**Why:** The user approved the responsibility-routing proposal but explicitly excluded default kitchens.

**How to apply:** Keep receiving responsibility separate from kitchen selection; do not restore sole-option auto-selection as a usability shortcut.

Operations managers receive exception notifications rather than every routine lifecycle update. This does not remove their management or intervention authority.

**Why:** The goal is to reduce routine notification noise while retaining oversight of missing responsible staff, overdue requests, and receiving discrepancies.

**How to apply:** Distinguish notification targeting from action authorization. Staff assignments never grant permissions by themselves; assignment and the relevant current action permission must both be checked.

Automatic receiving responsibility follows a unique eligible branch manager's primary branch, not additional branch-access grants. Preserve an eligible explicit manual receiver override; show a conflict rather than choosing arbitrarily among multiple primary managers.

**Why:** The user requested automatic responsibility for the manager assigned to a specific branch while retaining settings for appointing responsible staff. Additional access is not a managerial appointment.

**How to apply:** Resolve against current active membership and receiving permissions on each authorization/notification path; never persist the derived manager as a manual assignment, which would survive transfer incorrectly.

Kitchen ownership is implicit for eligible production-and-development managers, not a manually named kitchen responsible/deputy. This role does not itself authorize confirming receipt for a destination branch.

**Why:** On 2026-09-25 the user explicitly removed the need to appoint a kitchen manager and identified production/development management as the kitchen authority, with each branch's assigned manager responsible for receiving.

**How to apply:** Resolve current action permissions, keep legacy kitchen assignments as historical data only, and direct kitchen lifecycle notifications to eligible role holders. Receipt and discrepancy settlement follow the receiving manager boundary, with explicitly authorized administrative intervention retained.