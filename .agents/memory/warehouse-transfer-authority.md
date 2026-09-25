---
name: Warehouse transfer source and destination authority
description: Why outbound transfer authority is not the same as receiving authority.
---
A user authorized to operate source branch A may initiate an outbound material transfer to branch B without being entitled to operate B. Only a user authorized for the destination may confirm its receipt.

**Why:** Requiring both branch permissions at creation would block legitimate inter-branch supply. A source-authorized outbound request is not, by itself, a cross-branch authorization defect; receipt is the separate destination-controlled action.

**How to apply:** Audit module/action permission and the responsible side of each transition separately. A branch requesting from the main warehouse is the destination-side request exception, not permission to approve warehouse dispatch. Seeing a transfer involving an allowed branch must not grant access to the counterparty's unrelated stock, notifications, or aggregate reports.

Central-kitchen raw-material supply and finished-product shipment to an independent warehouse are distinct workflows. A kitchen's raw-material receipt must credit its existing authoritative material stock; an independent warehouse's finished-product receipt must not become raw-material stock or duplicate the main warehouse's balance.

**Why:** The user explicitly requested both directions, rather than treating a kitchen as an ordinary product-requesting branch or treating an independent warehouse as a branch alias.

**How to apply:** Preserve existing kitchen identities and stock continuity. A supply receipt does not activate ingredient consumption or approve recipes. Keep source-lot dates when moving finished goods, and leave historical transfer posting policy unchanged when introducing dispatch-time posting for new kitchen requests.