---
name: Warehouse keeper scope and virtual warehouse identity
description: Main-warehouse-only authority, virtual branch identity, and separation from branch receiving and driver execution.
---
Warehouse keeper authority is limited to the main warehouse, including its outbound requests to any branch or kitchen, not all-branch inventory administration.

**Why:** The user explicitly requested a warehouse operator who fulfills requests from all branches; the requester being elsewhere must not grant authority over that branch's stock or unrelated transfers.

**How to apply:** Check source ownership for approve/dispatch/assignment and destination ownership for receipt. Retain branch receipt inside its source request while keeping the standalone delivery workspace for drivers, warehouse keepers and explicit admin intervention.

The main warehouse is a virtual scope, not a persisted primary branch. Store a keeper's primary branch as null and derive the operational warehouse scope from the role; do not create a synthetic branch row or write the sentinel into the user's branch foreign key.

**Why:** The user branch field references real branches, while legacy main-warehouse inventory uses a sentinel and canonical catalogue stock. Persisting that sentinel can fail the foreign key; a synthetic branch would conflate separate identities.

**How to apply:** Keep account editing, fresh authorization, branch bootstrap and UI scope consistent. Ignore old branch grants for this role, preserve explicit permission revocation, and never infer ownership from an ambiguous historical null movement-log branch.