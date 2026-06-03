---
name: QR Loyalty Campaign System
description: How the reusable QR loyalty / digital discount-card feature fits together (Marketing + Event POS)
---

# QR Loyalty Campaign System

Reusable per-customer discount-card feature. Staff share a campaign QR → customer
opens `/join/:slug`, enters name+phone → gets a UNIQUE code shown as a web card at
`/card/:code` → redeemable a configurable number of times at the Event POS.

## Key non-obvious decisions / constraints
- **No OTP** is a deliberate product decision. Registration is idempotent by phone:
  re-registering the same phone+campaign returns the SAME code (not a new one).
  Re-validate this before "adding security" — returning the same code is intended.
- **Redemption is the authoritative validation path.** `redeemLoyaltyInTx`
  (server/loyalty-routes.ts) row-locks the member `FOR UPDATE` and re-checks
  status/branch/availability/minimum-order/usage server-side. `/api/loyalty/validate`
  is only a UI preview — never trust it for enforcement.
- POS integration hangs off `storage.createPosSale(saleData, items, afterInsert)`:
  the optional `afterInsert(tx, newSale)` callback runs inside the SAME sale
  transaction, so redemption + sale are atomic. Loyalty errors throw Arabic
  messages; the POS route surfaces them as 400 via an Arabic-substring regex —
  if you add a new loyalty error message it MUST contain one of those keywords
  (بطاقة/الولاء/استنفاد/الحملة/الفرع) or it leaks as a 500.
- `loyalty_members` has `apple_serial` / `google_object_id` placeholder columns
  reserved for a future native-wallet task — they are intentionally unused now.

## Permissions
- Admin campaign/member/redemption routes: `marketing` module perm.
- POS validate: `event_pos:create`.

**Why:** these constraints came out of the build + code review; getting the
atomicity/error-surface wiring wrong silently breaks redemption or hides errors.
