---
name: Branch manager request cycle
description: Requester and recipient authority is separate from warehouse, kitchen and carrier operations.
---
Branch managers handle their assigned primary branch's kitchen requests, warehouse material requests, physical receipts, discrepancies and eligible return requests. The delivery desk is also a tracking/receipt surface for them, not a shipping administration surface.

**Why:** The user approved one coherent branch lifecycle without granting warehouse-wide stock management, kitchen source approval/preparation/dispatch, driver management or write-off authority. An additional branch-access grant alone should not appoint another branch's manager.

**How to apply:** Keep material requester/recipient access separate from broad warehouse grants. Counts, facets, attachments, reports and mutation authorization must use the same branch boundary. Preserve assigned kitchen receivers and explicit manual receiver overrides. Physical receipt remains authoritative, and delivery approval belongs to its authenticated receipt actor. Return requests/cancellation belong to the branch manager; actual reverse dispatch belongs to the responsible operator.

Explicit permission overrides, including empty module action lists, must replace role defaults rather than union with them.

**Why:** Otherwise permission removal in the management screen leaves intrinsic backend authorization active or restores stale frontend buttons.

**How to apply:** Keep server guards, effective-permission APIs and frontend grants aligned; never restore denied actions merely because the role is branch_manager.