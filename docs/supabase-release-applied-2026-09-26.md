# Supabase additions applied — 2026-09-26

## Authorization and target

The user explicitly authorized applying the missing additions while preserving existing data and files, to project `irgeqdrdaejhedlcbvzz` (`https://irgeqdrdaejhedlcbvzz.supabase.co`). They reported a backup dated September 26. Backup availability was user-reported, not independently inspected or restore-tested. Supabase database backups exclude Storage object contents; this operation did not modify Storage.

The database connection used by the migration tool was `postgres`, schema `public`. The project reported `ACTIVE_HEALTHY`. This confirms the explicitly authorized database target, **not** the database identity of the separate Render service.

## Fresh preflight

- Three maintenance tables now existed, unlike the earlier audit. Their 33 columns, constraints and indexes passed the prepared checks. RLS was enabled, no policies; existing browser grants were not changed. **Skipped maintenance migration 039.**
- Existing 033 recipe and 039 catalogue prerequisites passed. Neither was replayed.
- Eight other tables and eleven columns on existing tables were absent.
- No existing internal-bar-policy transfers, linked kitchen batches or advanced-plan batches were found by bounded count queries. No long-running transaction over 30 seconds was observed at preflight.
- Existing closure-journal duplicate query returned no groups. Its missing uniqueness constraint remains a separate decision and was **not** applied.

## Applied, individually and in this order

| Local source | Supabase migration name |
|---|---|
| `migrations/042_internal_branch_bar_handoffs.sql` | `internal_branch_bar_handoffs_secured` |
| `migrations/045_branch_complaints.sql` | `branch_complaints_secured` |
| `migrations/043_recipe_exceptions.sql` | `recipe_exceptions_secured` |
| `migrations/044_advanced_request_coverage.sql` | `advanced_request_coverage_secured` |

All four calls returned `success: true`. Each script includes an atomic transaction, a 5-second lock timeout and a 60-second statement timeout. New tables use RLS and no policies; direct PUBLIC/anon/authenticated table and sequence grants are revoked. New function EXECUTE grants are revoked from PUBLIC/browser roles while server access is retained. Existing parent-table permissions were not changed.

The branch-bar conditional CHECK was hardened before application to reject NULL internal status/receipt totals without rejecting ordinary pending transfers. The 044 active flag is explicitly cast to text to accommodate historic boolean/text schemas.

**Branch-bar activation:** `2026-09-26T13:52:20.095887+00:00` (16:52:20 Riyadh). This is a prospective cutoff, not historical opening stock. Its singleton activation row is the only operational configuration row intentionally inserted. No historical backfill, test business rows, stock balances, product mappings, recipe approvals or exceptions were created.

## Verification

- Disposable local PostgreSQL rehearsal applied all five source scripts twice, verified constraints/guards and role access, and replayed with optional browser roles absent.
- `bash tests/supabase-release-migrations.sh` passed, including NULL-status and NULL-receipt-total rejection, valid pending/received transfers, exception consumption, FK and append-only guards.
- `bash tests/045_branch_complaints_migration.sh` passed.
- Existing recipe-exception concurrency and advanced-link integration suites were adapted only in their disposable SQL copies for explicit schema qualification; both passed against a fresh loopback-only PostgreSQL instance (two files, two tests), without project credentials.
- After remote application, **249/249** metadata checks from `docs/supabase-release-checks.sql` passed; no missing/false check results.
- Eight newly created tables: RLS enabled, no policies, no effective browser-role table privileges; postgres and service_role SELECT retained.
- Six new sequences: no effective browser-role USAGE/SELECT/UPDATE; service_role USAGE retained.
- Ten new functions: no anon/authenticated EXECUTE; postgres EXECUTE retained.
- New stock/events/exceptions/links/complaint tables remained empty. The activation singleton exists.
- Public `https://thebutterbakery.com/api/health` returned healthy/database connected; the public login page rendered. These checks do not prove that Render uses this database or certify authenticated workflows.

## Remaining boundaries

No application deployment, production restart, Storage mutation, deletion, type conversion, legacy constraint validation or unrelated index creation was performed. Existing index-name/type/nullability drift from the historical audit is not all resolved by these four migrations. Recipe and sales mappings, verified opening counts, and a controlled authenticated operational cycle remain separate work; phases one/two are not certified fully closed.