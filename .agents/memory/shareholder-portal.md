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

# Profile-update requests (self-service with approval)

- Shareholders never mutate their own row directly. Edits to a WHITELISTED field set (phone/email/address/bankName/bankAccountNumber/iban) become approval requests; admin approval applies them atomically to `shareholders` + notifies. Each request row is the audit trail.
  - **Why:** bank/contact fields are sensitive; direct self-edit = fraud/mass-assignment risk. Approval + immutable per-row audit gives accountability.
  - **How to apply:** whitelist enforced on BOTH create (build diff only from allowed fields) AND approve (rebuild updateSet only from `EDITABLE_FIELD_KEYS`) — never trust the stored `changes` blob blindly.
- "One pending request per shareholder" and "review once" are enforced at the DB layer, not just by a read-then-write check.
  - **Why:** the app-level `SELECT pending then INSERT` / `status==='pending'` guards are race-prone; two concurrent admins or double-submits violate the invariant.
  - **How to apply:** partial unique index `uq_shareholder_pending_profile_request ON (shareholder_id) WHERE status='pending'` (catch 23505 → 409 on create). Approve/reject update with `WHERE id=? AND status='pending'` + `.returning()`; 0 rows → 409. Approve does the guarded request-update FIRST inside the txn, then applies shareholder changes, so a lost race rolls back the whole apply.
- Shareholder-facing request list uses explicit projection (no `reviewedBy`/`createdBy`) — same internal-id-leak rule as tickets.

# Printable statement & showFinancials gating

- The portal `showFinancials` toggle must be enforced server-side, not just in the UI. `/api/shareholder/me` redacts bank fields (`bankName`/`bankAccountNumber`/`iban`) from the payload when `showFinancials` is off; client-only hiding still ships the data to the browser.
  - **Why:** presentation-only gating leaves sensitive fields in the client (and in any printable HTML built from them). Honor admin intent at the payload boundary.
  - **How to apply:** when financials are off ALSO (a) drop the 3 financial fields from `editableFields` in GET profile-requests, and (b) skip them in the create-request diff loop — otherwise the redacted-empty form seeds a spurious "clear my bank info" change request. The 3 keys live in `FINANCIAL_FIELD_KEYS`.
- The portal builds printable docs (account statement, meetings, minutes) by `window.open` + `document.write` of an RTL HTML string via `printDoc()`; user prints to PDF. EVERY DB value interpolated MUST pass through `esc()` (about:blank origin = XSS risk). Statement content gates (financials/dividends) mirror the portal section settings.
