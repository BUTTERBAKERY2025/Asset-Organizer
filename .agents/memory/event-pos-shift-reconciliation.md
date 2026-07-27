---
name: Event POS shift reconciliation
description: Invariants for pos_shifts cash reconciliation, refund accounting, and sale/shift race protection
---

Rules:
- Refund/void retries are idempotent: pos_refunds has (sale_id, idempotency_key) partial unique index; createPosPartialRefund checks the key BOTH before the tx AND again after locking the sale (a same-key concurrent request may have completed and flipped status to refunded) + catches 23505; void returns the sale as-is when already voided.
- Refund accounting is LEDGER-BASED (since 2026-07-27): full AND partial refunds both write pos_refunds rows (full refund = refundPosSaleFull → createPosPartialRefund on all remaining quantities). refund_method (cash|network) drives expected-cash/network subtraction.
- Countable-sale predicate everywhere in stats (shift stats, daily summary, range summary, event report): `status IN ('completed','partially_refunded') OR (status='refunded' AND EXISTS pos_refunds row)`. Legacy fully-refunded sales (pre-ledger, no pos_refunds rows) stay excluded and must NOT be added back — they have nothing offsetting them.
- Refund-subtraction queries join pos_refunds and filter sale status IN ('partially_refunded','refunded') (not just partially_refunded), otherwise ledger-based full refunds double-subtract or leak.
- Partial refunds on discounted sales scale total AND vat by (1 - discount/saleGross), then subtotal = total - vat — same basis as sale-side discount math.
- `closePosShift` locks the shift FOR UPDATE and must pass its `tx` into `getPosShiftStats(shiftId, tx)`; `createPosSale` re-locks the shift inside its own transaction and throws an Arabic "الوردية مغلقة" error if not open — this pair prevents sales landing on a just-closed shift.
- The sale route's catch surfaces Arabic validation messages via a regex (بطاقة|الولاء|...|الوردية) → 400; new transactional Arabic errors must be added to that regex or they become 500s.
- `/api/pos/shifts/*` routes must load the event and enforce `canAccessBranch(req, event.branchId)` — shift lookups by eventId alone are IDOR-prone.

**Why:** old model (full refund = status flip only, no ledger) lost the cash-out event when refund happened in a different shift than the sale; also over-refunded VAT on discounted partial refunds.
**How to apply:** any change to POS refunds, shift close, sale creation, or ANY stats/summary query must preserve the countable-sale predicate + ledger subtraction pair together. There are TWO summary functions (daily getPosSalesSummary(branchId,date) AND a range version) — update both.

## Post-deep-review invariants (2026-07-27)
- Sale creation recomputes ALL money server-side from branch_products (priceOverride ?? basePrice, vatRate) — client totals/prices are never trusted.
- saleDate/saleTime are server-stamped in Asia/Riyadh (client clock never trusted); client "today" filters use Intl with Asia/Riyadh; ZATCA QR parses saleDate/saleTime with explicit +03:00.
- Partial refund locks its target shift FOR UPDATE; if shift is closed the refund is detached (shift_id NULL) so closed-shift reconciliation never drifts.
- `uniq_pos_shifts_open` partial unique index on (event_id, cashier_id) WHERE status='open'; openPosShift catches 23505 and returns the existing shift.
- Void/full-refund/held-order-delete routes must fetch the resource and enforce canAccessBranch; shift stats are owner-or-edit-permission only.
