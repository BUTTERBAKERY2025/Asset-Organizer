---
name: Leave notifications & date-edit
description: How employee notifications fan out (in-app/WhatsApp/SMS) and the design rule for editing leave dates after approval.
---

# Employee notification fan-out
`notifyEmployeeOfDecision` (server/notify-helpers.ts) sends an in-app bell entry (only if `emp.linkedUserId`) plus one external queue row **per channel**. It defaults to **WhatsApp only** to preserve existing callers (advances, etc.); pass `channels: ["whatsapp","sms"]` for dual-channel.

**Why:** the scheduler dispatches each queued row by its single `channel` field (whatsapp → sendWhatsAppMessage, sms → sendSMS). One row = one channel, so dual delivery needs two rows.

**How to apply:** for any event the user wants on "واتساب/SMS", pass both channels. Note `TWILIO_WHATSAPP_NUMBER` is often unset (falls back to the sandbox number), while SMS uses the configured `TWILIO_PHONE_NUMBER` — so SMS is usually the reliable channel.

# Editing leave dates after submission
Editing start/end dates of an existing leave (pending or approved) intentionally **keeps the approval cycle as-is** (no re-cycle) — explicit product decision. The edit is appended to the `approvalFlow` jsonb (reuse, no new column), days recomputed, overlap re-checked excluding self, and attendance re-synced for approved leaves (reverse auto records then re-sync).

**Why:** re-cycling every minor date correction would block already-approved leaves; the user chose record+notify instead.
