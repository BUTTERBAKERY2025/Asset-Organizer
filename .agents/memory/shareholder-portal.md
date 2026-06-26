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
- Meeting minutes shown/printed in the portal are ONLY signed/archived OR `isLocked=true` records — never drafts.
  - **Why:** minutes are immutable official records (Saudi Companies Law M/132); exposing drafts to shareholders would leak un-ratified content.
  - **How to apply:** the `/api/shareholder/meetings` join filters on that condition and attaches the newest such record per meeting.
- Shareholder-facing ticket/message responses must use explicit column projection (NOT `.select()`/`select *`) to exclude internal fields like `senderUserId`/`createdBy`.
  - **Why:** raw row select leaks internal user identifiers to shareholders; ownership gating doesn't help once the row shape is over-broad.
  - **How to apply:** shareholder ticket detail (`/api/shareholder/tickets/:id`) selects only id/ticketId/senderType/senderName/body/createdAt. Admin side may return full rows (internal).
- Credential delivery from the admin investor-portal uses a client-side `wa.me` deep link (prefilled message), NOT the Twilio notification queue.
  - **Why:** user reported the backend WhatsApp queue "doesn't work well"; the deep link lets the admin review and send from their own WhatsApp. Tradeoff: password passes through the admin device's wa.me URL — acceptable here since the admin generated it and the old queue also sent plaintext.
  - **How to apply:** Saudi phone normalization → international `966...` before building the URL.
