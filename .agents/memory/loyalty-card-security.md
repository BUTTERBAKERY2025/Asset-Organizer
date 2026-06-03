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
- **Phone ownership is now SMS-OTP gated.** The old `POST .../:slug/register`
  (which returned the card code immediately) is removed. Flow is two-step:
  `request-otp` (sends 6-digit SMS, stores hash + pending name/gender/city in
  `loyalty_otp_codes`, NEVER returns the code or whether the phone is
  registered) then `verify-otp` (issues/returns the card only on correct code).
  OTP: 10-min TTL, 60s resend cooldown, max 5 sends, max 5 wrong attempts,
  one-time use (row deleted on success). Verify trusts ONLY the server-stored
  payload, never client-resent registration fields. If Twilio is unconfigured
  or SMS send fails, request-otp returns 503 (never leaks the code).
