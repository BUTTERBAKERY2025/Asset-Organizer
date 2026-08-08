---
name: Web Push notifications
description: Mobile push for systemNotifications — VAPID in DB, targeting parity, double-send guard
---
- VAPID keys are NOT env vars: auto-generated into `push_vapid_config` (advisory-lock insert, everyone reads OLDEST row) so dev/Render work with zero setup. Never regenerate — existing device subscriptions die.
- Push targeting must mirror getActiveNotificationsForUser: targetUserIds exclusive; else branch (users.branchId OR user_branch_access) + role. Any change to bell targeting must update server/push-service.ts resolveTargetUserIds.
- Double-send guard = `system_notifications.push_sent_at` claimed via conditional UPDATE (WHERE push_sent_at IS NULL); creation hook sends immediate ones, scheduler sweep (5min) sends scheduled ones when due.
- Unsubscribe deletes by endpoint AND session userId (endpoint-only was a cross-user DoS).
- iOS: push only works when PWA saved to home screen (iOS 16.4+); prompt component skips iOS browser mode.
- Tables auto-created in startup migrations (server/db.ts) — safe on Render deploys.
