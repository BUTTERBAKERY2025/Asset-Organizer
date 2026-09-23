---
name: Warehouse transfer source and destination authority
description: Why outbound transfer authority is not the same as receiving authority.
---
A user authorized to operate source branch A may initiate an outbound material transfer to branch B without being entitled to operate B. Only a user authorized for the destination may confirm its receipt.

**Why:** Requiring both branch permissions at creation would block legitimate inter-branch supply. A source-authorized outbound request is not, by itself, a cross-branch authorization defect; receipt is the separate destination-controlled action.

**How to apply:** Audit module/action permission and the responsible side of each transition separately. A branch requesting from the main warehouse is the destination-side request exception, not permission to approve warehouse dispatch. Seeing a transfer involving an allowed branch must not grant access to the counterparty's unrelated stock, notifications, or aggregate reports.