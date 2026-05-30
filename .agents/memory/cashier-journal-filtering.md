---
name: Cashier journal filtering & pagination
description: Why cashier-journals filtering keys on cashierName (not cashierId), and the server-side pagination shape.
---

# Cashier journal (cashier-journals) filtering

- **Filter by `cashierName`, NOT `cashierId`.** `cashierName` is a free-text field on
  each journal. `cashierId` is only force-set to the creator's user id on self-create;
  for manager-entered journals it is often empty. So any cashier-facing filter/dropdown
  must use the name, and the dropdown list must come from a distinct-`cashierName` query
  over the journals themselves — never from the users table (names won't reliably match).
  **Why:** matching by id silently returns nothing for manager-entered journals.

- **Non-manager scoping is enforced server-side via forced `cashierId`** (set to the
  authenticated user's id), AND-ed with any other filter. So passing a `cashierName` is
  safe for non-managers (it can only narrow to their own rows).
  **Caveat:** the stats endpoint (`/stats/summary`) previously let a client-supplied
  `cashierId` query param OVERWRITE the forced own-id → access-control leak. Always gate
  arbitrary `cashierId`/`cashierName` query params behind `canUserViewAllCashiers`.

- **Server-side pagination shape:** `GET /api/cashier-journals` returns a raw array when
  no `limit` is sent, or `{journals,totalCount,page,pageSize,totalPages}` when `limit` is
  present. Export/print must fetch ALL matching rows (call WITHOUT `limit`) so they cover
  the full filtered set, not just the visible page.

- New filter-dropdown endpoint is two-segment (`/api/cashier-journals/filters/cashiers`)
  on purpose: a single-segment path would collide with `/api/cashier-journals/:id`.
