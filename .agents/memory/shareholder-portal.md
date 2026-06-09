---
name: Shareholder portal & investor governance
description: Auth/IDOR model and surface for the shareholder self-service portal + governance investor-portal admin page.
---

# Shareholder portal access model

- Shareholders log in with dedicated accounts (role `shareholder`) that an admin links to a `shareholders` row via `shareholders.linkedUserId` (→ users.id).
- The portal surface (`/api/shareholder/*`, page `/shareholder-portal`) is gated by BOTH: role === "shareholder" AND a linked shareholder row. Both checks live in `getMyShareholder()` in `server/shareholder-portal-routes.ts` (returns null if role != shareholder or no linkage).
  - **Why:** linkage alone is not enough — an admin or other role linked to a shareholder row would otherwise reach portal data. Role enforcement is the explicit policy gate; linkage is the per-user ownership scope.
  - **How to apply:** never resolve the current shareholder from a client-supplied id. Always re-resolve server-side from session userId. Ownership for notification-read and vote-casting derives from the resolved shareholder id, not request params.
- Admin investor-portal routes (`/api/governance/*`) are gated by `requirePermission("governance_shareholders", <action>)`.
- `/api/shareholder/me` returns `{ hasShareholder: false }` (not 403) for non-shareholders so the portal page can render a clean empty/redirect state; other portal queries are `enabled: !!hasShareholder`.
- Reachable from the governance hub (`/governance`) tile, not a dedicated sidebar item — consistent with other governance sub-pages.
