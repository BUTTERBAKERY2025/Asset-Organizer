---
name: Kitchen branch availability declarations
description: Manual branch stock declarations are not inventory adjustments or net demand calculations.
---

Keep the branch's declared available quantity separate from authoritative stock and the requested delivery quantity.

**Why:** The user explicitly requires the requester to enter what is available at their branch. This is information for kitchen review, not permission to change stock or reduce the delivery request automatically.

**How to apply:** Do not silently prefill this required declaration from stock balances or default it to zero. A deliberate zero is valid; missing historical declarations remain unknown. Changes to the selected item or requesting branch invalidate the draft declaration.