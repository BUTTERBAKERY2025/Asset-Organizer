---
name: Notification write path (overloaded storage method)
description: Which table/method to use for in-app vs WhatsApp notifications, and the storage.createSystemNotification overload trap.
---

# In-app vs WhatsApp notifications

There are TWO distinct in-app notification tables:
- `notifications` — the employee-portal per-user inbox. A null userId is NOT a working branch broadcast: the recipient reader requires the current user's ID.
- `system_notifications` — a separate, unrelated table with different required fields (e.g. `content`).

## The trap
`storage.createSystemNotification` is **defined twice** in `server/storage.ts`. In a TS class the LATER definition wins at runtime, and the effective one targets `system_notifications` (needs `content`), NOT the `notifications` table. So calling `storage.createSystemNotification({ userId, message, ... })` to write an inbox row **silently fails** if the caller swallows errors.

**Rule:** to write an inbox row to the `notifications` table, insert directly: `db.insert(notifications).values({...})`. Do not rely on `storage.createSystemNotification` for that.

**Why:** the overload mismatch produced success-looking HTTP responses while no rows were created (notification helpers intentionally never throw). Cost a review cycle to catch.

## WhatsApp / SMS
Queue outbound messages via `storage.createNotification({ recipientPhone, recipientName, channel: 'whatsapp'|'sms', message, relatedModule, relatedEntityId })` → writes to `notification_queue`; the scheduler (60s tick) delivers via Twilio. This method is unambiguous (single definition).

Reviewer workflow alerts must use current source authority and exact recipients on the system-notification surface, separately from employee personal messages and external channels.

**Why:** Null-recipient HR inbox rows had no reader, while copying a role or an old reviewer list would preserve access after a branch or approval-stage change.

**How to apply:** Resolve the reviewer from the persisted workflow stage and current grants at creation and again at read/Push. Do not backfill old alerts or broadcast when no eligible reviewer exists; log that condition explicitly.
