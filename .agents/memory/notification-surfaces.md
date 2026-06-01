---
name: Two notification tables — which one the user actually sees
description: Critical distinction between the `notifications` table and the `systemNotifications` table; in-app alerts must go to systemNotifications.
---

# The bell/popup reads `systemNotifications`, NOT `notifications`

There are TWO separate notification surfaces:

- **`systemNotifications` table** = the REAL user-facing alerts. Shown via:
  - `/api/active-notifications` -> `getActiveNotificationsForUser` (popup banner/modal,
    mounted for ALL authenticated users in layout.tsx). No permission gate.
  - `/api/system-notifications` -> `getAllSystemNotifications` (the bell dropdown;
    requires `settings:view`).
  - Targeting is by **branch + role only**: `targetAllBranches` / `targetBranchIds` /
    `targetRoleIds` (matched against `users.role`). There is NO per-user/targetUserIds
    column — individual targeting requires a schema change.
- **`notifications` table** = a separate per-user surface, read only by `/api/notifications`
  (`users:view`). The bell does NOT read it. Writing here (e.g. via
  `NotificationService.createBulkNotifications`) will NOT show the user any alert.

**Why:** A targeted-message feature wrote in-app alerts to `notifications` and recipients
saw nothing. Fix was to write `systemNotifications` rows instead.

**How to apply:**
- To make an in-app alert a normal user will actually see, create a `systemNotifications`
  row (via `storage.createSystemNotification`) targeted by branch + role.
- `getActiveNotificationsForUser` filters `targetRoleIds.includes(users.role)`. So derive
  `targetRoleIds` from each recipient's REAL `users.role`, not from a job_title/position
  string — a person resolved by job_title may have a different `users.role` and would
  otherwise never see it.
- Two admin pages exist: `/notifications-management` ("الإشعارات والرسائل العامة", manual
  create button "إشعار جديد") and `/notifications-center` ("مركز الإشعارات والتقارير",
  schedules + targeted-by-position message). Both gated by `settings` module, adminOnly.
