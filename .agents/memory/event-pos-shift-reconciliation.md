---
name: Event POS shift reconciliation
description: Invariants for pos_shifts cash reconciliation, refund accounting, and sale/shift race protection
---

Rules:
- Shift stats (`getPosShiftStats`) count sales with status IN ('completed','partially_refunded') ONLY. Full refunds flip the sale to 'refunded' with NO pos_refunds row — excluding them nets the money to zero. Never add 'refunded' back to the totals or expected cash gets overstated.
- Partial refunds DO write pos_refunds rows (subtracted from expected cash/network by refund_method). Keep the two models consistent: full refund = exclusion, partial refund = pos_refunds subtraction.
- `closePosShift` locks the shift FOR UPDATE and must pass its `tx` into `getPosShiftStats(shiftId, tx)`; `createPosSale` re-locks the shift inside its own transaction and throws an Arabic "الوردية مغلقة" error if not open — this pair prevents sales landing on a just-closed shift.
- The sale route's catch surfaces Arabic validation messages via a regex (بطاقة|الولاء|...|الوردية) → 400; new transactional Arabic errors must be added to that regex or they become 500s.
- `/api/pos/shifts/*` routes must load the event and enforce `canAccessBranch(req, event.branchId)` — shift lookups by eventId alone are IDOR-prone.

**Why:** architect review found overstated expected cash and a close/sale race in the first implementation.
**How to apply:** any change to POS refunds, shift close, or sale creation must preserve these invariants together.

## Post-deep-review invariants (2026-07-27)
- Sale creation recomputes ALL money server-side from branch_products (priceOverride ?? basePrice, vatRate) — client totals/prices are never trusted.
- Partial refund locks its target shift FOR UPDATE; if shift is closed the refund is detached (shift_id NULL) so closed-shift reconciliation never drifts.
- `uniq_pos_shifts_open` partial unique index on (event_id, cashier_id) WHERE status='open'; openPosShift catches 23505 and returns the existing shift.
- Void/full-refund/held-order-delete routes must fetch the resource and enforce canAccessBranch; shift stats are owner-or-edit-permission only.
- Sales reports/summary count status IN ('completed','partially_refunded') then subtract pos_refunds (joined only on partially_refunded sales; fully 'refunded' sales are already excluded).
