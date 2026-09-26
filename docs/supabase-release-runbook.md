# Supabase release preparation — operator runbook

**Not applied to production or any Supabase project.** These are individually reviewed, additive changes, not a concatenated migration bundle. `docs/supabase-release-gap-audit.md` is historical read-only evidence for the documented target, not proof of Render's effective connection. The application must not be deployed until an authorized operator confirms its actual database target, obtains approval and completes the gates below. Do not use `db:push`, app startup, or Replit managed-production SQL to migrate external Supabase.

## Preflight and approval

1. Independently confirm the runtime's effective database project/schema (without disclosing credentials), backup and *tested restore*, maintenance window, lock/traffic plan and rollback owner. Execute `docs/supabase-release-checks.sql` with read-only privileges on that confirmed target. Retain results. An absent object is not an instruction to blindly replay a file. Inspect existing objects and definitions for partial/drifted installs. In particular 039 catalogue and 033 recipe material/snapshot objects were observed **already present** on the audited target; verify, do not replay on the basis of filename/history.
2. Review the effect of 043 and 044 trigger guards on live/historical data, concurrent work and production workflows. Neither migration backfills legacy batches. Review FKs, constraint validation and unique indexes. Assess legacy check constraints already marked NOT VALID separately; do not validate, cast or repair unrelated data during this rollout.
3. Review 042 explicitly: it creates nine transfer columns, a partial idempotency-key index, a conditional transfer totals check and three bar tables. Its `INSERT ... ON CONFLICT DO NOTHING` sets the **one-time workflow activation cutoff** to the time of first application; legacy receipts are **not backfilled**. Verify receipt-policy prerequisite columns (`transport_policy`, `production_date`, `received_quantity`, `received_by`, `received_at`, `dispatched_at`) first. Consider potential old rows, locks and legacy missing-receipts sync before approval. Re-running 042 does not reset an existing activation timestamp. Do not fabricate a historical cutoff.
4. Review 045 against `shared/schema.ts` and `server/branch-complaints.ts`: three tables, varchar parent IDs, 35 columns, named FKs/checks, unique attachment path, append-only events, archivable attachment metadata. Its RLS is enabled with no policies and explicit revocation from `anon`/`authenticated`; the app-server's privileged connection must have access. **Do not grant direct browser-role table/sequence access.** An existing object with the same name is not proof of the same shape; stop on any drift and obtain a separate plan. It neither seeds nor backfills.

## Controlled order (only after approval)

Rehearse individual files and application scenarios on an isolated clone with realistic data and measure locks/time. Prior `migrations/039_finished_products_operational_sale_gates.sql` and `migrations/033_central_kitchen_batch_materials.sql` are verification-only where their objects already exist. Then, if absent and approved, apply independently:

1. `migrations/039_maintenance_tickets.sql` (not the unrelated 039 catalogue gates).
2. `migrations/042_internal_branch_bar_handoffs.sql` (approve activation cutoff).
3. `migrations/045_branch_complaints.sql`.
4. `migrations/043_recipe_exceptions.sql`, **before** `migrations/044_advanced_request_coverage.sql`.
5. `migrations/044_advanced_request_coverage.sql`.

The independent maintenance/bar/complaints steps have no dependency on each other; preserve the 043 → 044 dependency. Confirm each file's prerequisites before execution. Apply only missing, reviewed changes to the confirmed target in an authorized window, one file at a time. Stop on any error or unexpected metadata; do not retry by pushing the entire schema.

## Postflight / release gate

Run `docs/supabase-release-checks.sql` again on the same confirmed target, compare all required metadata: columns and types/nullability, tables, validated checks/FKs, unique/partial indexes, enabled triggers and function-body hardening (including 044's row lock and two `IS DISTINCT FROM` checks). The read-only checks show named objects and relevant definitions; manually inspect any unexpected definition drift and the 042 activation row using the optional query in the checks file. Confirm 045 RLS, lack of browser-role grants and lack of policies; test the privileged app connection separately. Verify actual app workflows in a controlled release and observe production health before enabling traffic. Metadata checks alone cannot prove runtime behavior or rollback readiness.

`branch_daily_closure_journals.journal_id` uniqueness is **a separate decision**: the last query in the checks file lists duplicates read-only (up to 100 groups). Review full duplicate counts, semantics and any existing equivalent index before separately approving `idx_closure_journal_unique`; do **not** enforce it as part of this rollout. Do not confuse it with `uq_daily_closure_branch_date`.

Rollback strategy: stop/disable affected routes or deployment, restore from the verified backup under owner control if needed; do not drop new tables or data automatically. Any corrective DDL/data repair requires separate review. Local-only rehearsal of 045: `bash tests/045_branch_complaints_migration.sh` starts a disposable PostgreSQL instance, installs minimal varchar parents, applies 045 twice and asserts schema/security/write guards. It never uses project credentials.