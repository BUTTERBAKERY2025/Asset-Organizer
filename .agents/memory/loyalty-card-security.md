---
name: Loyalty public card security boundary
description: What the public /card/:code endpoint may expose, code format, and the known phone-registration IDOR gap.
---

- The public endpoint `GET /api/public/loyalty/card/:code` must select ONLY
  `customerName` + campaign/card fields. It must NEVER select phone, gender, or
  city — those are stored server-side only. Keep any new customer columns OUT of
  this select.
- Member codes are `PREFIX-XXXXXXXX` (8 unambiguous base31 chars, no 0/O/1/I/L).
  Legacy `PREFIX-123456` (6 digit) codes are weaker but still valid; the card
  regex accepts both formats.
- **Known gap (IDOR):** public registration is idempotent by phone and returns
  the existing member code WITHOUT verifying phone ownership. Anyone who knows a
  customer's phone can recover their card code + name and abuse the discount.
  Proper fix = SMS OTP (Twilio is configured) before issuing/returning a code.
