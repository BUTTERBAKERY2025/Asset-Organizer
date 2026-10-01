---
name: Warehouse keeper scope and virtual warehouse identity
description: Main-warehouse-only authority, virtual branch identity, and separation from branch receiving and driver execution.
---
Warehouse keeper authority is limited to the main warehouse, including its outbound requests to any branch or kitchen, not all-branch inventory administration.

**Why:** The user explicitly requested a warehouse operator who fulfills requests from all branches; the requester being elsewhere must not grant authority over that branch's stock or unrelated transfers.

**How to apply:** Check source ownership for approve/dispatch/assignment and destination ownership for receipt. Retain branch receipt inside its source request. Branch managers now also use the standalone delivery workspace for branch-only tracking and receipt approval, not warehouse or driver management; see branch-request-cycle-boundary.md.

Warehouse-keeper authority uses a virtual scope. Store a keeper's primary branch as null and derive the operational warehouse scope from the role; do not create a synthetic branch row or assign the sentinel merely to grant warehouse authority.

**Why:** Legacy main-warehouse inventory uses a sentinel and canonical catalogue stock. Production also contains a real headquarters branch with the same identifier. That organizational branch must not be confused with the keeper's virtual inventory authority.

**How to apply:** Keep account editing, fresh authorization, branch bootstrap and UI scope consistent. Ignore old branch grants for this role, preserve explicit permission revocation, and never infer ownership from an ambiguous historical null movement-log branch.

For the supply follow-up desk, selecting the virtual main-warehouse scope can include branchless warehouse-to-warehouse movements only for actors with the source's global warehouse authority. Label it as a desk scope, never as the movement's source or destination.

**Why:** Warehouse transfers deliberately have warehouse IDs and null branch endpoints. Hiding them loses open work, but assigning them to an ordinary branch would invent ownership and risk exposing other warehouses.

**How to apply:** Require the explicit warehouse desk scope plus global authority; preserve real warehouse endpoints and source-side execution checks. Never persist synthetic branch IDs or grant warehouse keepers global warehouse access from this display rule.