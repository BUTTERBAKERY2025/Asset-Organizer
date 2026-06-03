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
- **Registration is DIRECT (no phone-ownership verification).** `POST
  .../:slug/register` validates {name,phone,gender,city} and immediately
  issues/returns the card code via `issueCardForVerifiedPhone()`. An SMS-OTP
  gate was built once (`request-otp`/`verify-otp` + `loyalty_otp_codes`) but was
  REMOVED at user request to fully postpone messaging; the `loyalty_otp_codes`
  table is intentionally left in the DB in case messaging returns.
  **Why:** the user wants WhatsApp (not SMS) and asked to defer the whole
  messaging topic. **Known gap:** anyone who knows a phone can re-register and
  get that phone's existing card code (`alreadyRegistered:true`) — acceptable
  for now; restore ownership proof before returning existing codes when
  messaging is re-enabled (prefer WhatsApp via Twilio).
