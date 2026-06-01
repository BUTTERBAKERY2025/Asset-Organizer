---
name: Two notification tables — which one the user actually sees
description: Critical distinction between the `notifications` table and the `systemNotifications` table; in-app alerts must go to systemNotifications.
---

# The bell/popup reads `systemNotifications`, NOT `notifications`

There are TWO separate notification surfaces:

- **`systemNotifications` table** = the REAL user-facing alerts. Shown via:
  - `/api/active-notifications` -> `getActiveNotificationsForUser` (per-user, filtered by
    branch+role, no permission gate). This now feeds BOTH the popup banner/modal AND the
    bell dropdown (`NotificationsDropdown`), mounted for ALL authenticated users.
  - `/api/system-notifications` -> `getAllSystemNotifications` is the ADMIN list only
    (`settings:view`); do NOT use it for the user-facing bell — it leaks all branches'
    notifications and 403s for non-admins (was the root cause of "bell missing/empty").
  - Bell unread count is computed client-side: active list minus per-user read ids from
    `/api/system-notifications/my-reads` (isAuthenticated; MUST be registered before the
    settings-gated `/:id` route or it gets shadowed/blocked). Read/dismiss go through
    `/api/system-notifications/:id/read` and `/dismiss` (both isAuthenticated only).
  - Bell rows are raw systemNotifications shape: `content` (not message), `messageType`
    (not type), integer `priority`, `buttonText`/`buttonAction`. Clicking opens a detail
    Dialog (full content) — there is no `linkUrl`; navigation is optional via buttonAction.
  - Targeting: `targetAllBranches` / `targetBranchIds` / `targetRoleIds` (vs `users.role`),
    PLUS `targetUserIds` (text[]) for per-person targeting. **When `targetUserIds` is set &
    non-empty it OVERRIDES branch+role** in `getActiveNotificationsForUser` — only those
    user ids see it, regardless of active branch/role. Empty/null → legacy branch+role.
  - `send-targeted` has `targetMode` ("position" | "individuals") + `displayStyle`
    (modal/fullscreen/banner/slide_in, rendered by `NotificationDisplay`). In-app delivery
    ALWAYS writes `targetUserIds` (exact selected linked users, per branch) — no more
    role+branch broadcast. Individuals are re-resolved server-side from the DB
    (`resolveTargetsByIdentifiers`: users by id + branch_employees by phone, branch-scoped)
    — client identifiers are never trusted. Picker: `GET .../search-people` (settings:view).
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
