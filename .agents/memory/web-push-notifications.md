---
name: Web Push notifications
description: Mobile push for systemNotifications — VAPID in DB, targeting parity, double-send guard
---
- VAPID keys are NOT env vars: auto-generated into `push_vapid_config` (advisory-lock insert, everyone reads OLDEST row) so dev/Render work with zero setup. Never regenerate — existing device subscriptions die.
- Push targeting must mirror getActiveNotificationsForUser: targetUserIds exclusive; else branch (users.branchId OR user_branch_access) + role. Any change to bell targeting must update server/push-service.ts resolveTargetUserIds.
- Push completion must mean delivery attempts finished, not merely claimed work; retries must skip confirmed device receipts.

**Why:** Marking a notification sent before contacting the provider loses it on a crash, and notification-wide success hides partial device failures. Provider acceptance followed by a failed receipt write remains inherently ambiguous: do not promise exactly-once delivery.

**How to apply:** Preserve separate claims and completion, bounded provider timeouts, per-device retry tracking, and historical no-replay boundaries when changing dispatch. Evaluate daily windows in Saudi time consistently with the bell.
- Unsubscribe deletes by endpoint AND session userId (endpoint-only was a cross-user DoS).
- iOS: push only works when PWA saved to home screen (iOS 16.4+); prompt component skips iOS browser mode.
- Tables auto-created in startup migrations (server/db.ts) — safe on Render deploys.

Shared-device subscriptions must not silently transfer between accounts during sync.

**Why:** A delayed sync or logout cleanup can overlap the next login; aborting a browser request cannot undo server work already executing. Endpoint-global reassignment can therefore route notifications to the wrong account.

**How to apply:** Keep subscription ownership checks atomic, revoke the browser endpoint when leaving an account, suppress stale sync generations, and bound cleanup without leaving cookie-bearing requests running into the next session. Do not weaken ownership conflicts to make re-enablement seem successful.
