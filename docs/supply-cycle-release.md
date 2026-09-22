# Branch requests and production execution release

## Deployment boundary

These changes are implemented in the project. They do not update the external
Supabase production schema or publish the Render service automatically.

Before deploying the code, review the existing production-cycle release
checklist, confirm the Render-linked database and backup/restore readiness, then
apply the following additive migrations to that approved external target:

1. `scripts/central-kitchen-request-changes.sql`
2. `migrations/material_transfer_creation_idempotency.sql`
3. `migrations/advanced_production_explicit_execution.sql`

Apply the SQL files as complete scripts. Do not use `db:push`. The migrations
preserve existing orders and inventory and do not infer historical batch links.
The advanced-execution migration requires the existing recipe snapshot,
production-material, and stock-posting schema to be installed first.

The three migrations were also applied to the authorized external production
database on 2026-09-22, after the approved trial-data cleanup. Their columns,
indexes and advanced-execution trigger definitions were checked. This does not
publish the application code: Render rollout remains a separate user action.

## Authorized trial reset

On 2026-09-22 the user confirmed that all finished-goods balances were trial data.
Production/kitchen requests, production batches and trial transfers were removed
in a snapshot-bound transaction; finished-goods rows were retained with zero
quantities/reservations and no last-batch references. Production-linked display
receipts were removed; ten receipts without an explicit batch link were retained.
Products, recipes, raw-material balances, users, branches, sales and accounting
were outside the deletion scope.

Selective backups and maintenance verification records are under the ignored
`.local/backups/` directory. A full cleanup/restore rehearsal using the then-live
foreign keys and triggers succeeded and was rolled back before the committed
cleanup. The committed state was checked from a new read-only connection.
The later additive migrations mean any future restore must be reviewed against
the current schema; do not rerun a historical cleanup or overwrite subsequent
real operations. Internal sequences were deliberately not reset.

Opening quantities must come from the physical stocktake, not inferred from the
removed trial history. Do not start real operation on the old Render code.

## Operating rules

- Product deletion now archives the product; it preserves its identity and
  historical references. Product edits reject internal/immutable fields.
- Material transfer creation requires a separate `Idempotency-Key`. A business
  request ID is not a retry key. The UI retains an ambiguous request's key so a
  retry cannot silently become another transfer. Empty transfers are rejected.
- A requesting branch may edit quantities/date/time/notes on a requested kitchen
  order, or cancel a requested/approved order, before production or stock
  commitments exist. Reasons and the displayed revision are required.
  Assortment/identity changes require cancelling and creating a new request.
- Prepared, dispatched, received, and production-linked requests cannot use this
  cancellation action. It does not reverse production, reservations or stock.
- Advanced plan execution uses explicit order-item-linked batches. It requires
  source-branch access and an approved recipe with a frozen material snapshot.
  Creation does not consume materials; finishing uses the normal atomic material
  consumption and finished-stock posting path.
- Cancelling an unfinished linked batch releases planned execution capacity, not
  physical stock. Completed batches and executed plan identities are protected.
- Historical unlinked production remains unknown in plan comparisons. General
  actual-production totals are not the same metric as plan-linked actual totals.

## Verification and rollout checks

Run focused unit/HTTP suites and rollback integration suites on development,
never production. Some database suites do not include `.integration` in their
filename; inspect their connection and cleanup guards before running them.

After the production schema update and Render deployment, verify the four UI
paths with authorized branch/production accounts: archive/edit product, create
and retry a material transfer, edit/cancel an uncommitted kitchen request, and
execute a recipe-backed advanced-plan item. Use designated test records and
verify the before/after stock effects; do not infer success from a build alone.