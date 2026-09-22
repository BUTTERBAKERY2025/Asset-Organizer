# Central-kitchen migration release checklist

## Blockers and prerequisites

- [ ] Confirm the authorized Render-linked target, its currently applied migration state, and schema drift. Unknown target state blocks release.
- [ ] Confirm a current backup and a tested restore path before any schema change. Missing backup confirmation blocks release.
- [ ] Rehearse the canonical SQL in development or an isolated disposable transaction/schema and record the result.

## Read-only target preflight

- [ ] From the approved operator session, connect to the actual Render-linked production database and verify the database/schema target before running anything. Do not use an unrelated database, connect to an external target, or put credentials in the repository.
- [ ] Run `scripts/central-kitchen-release-preflight.sql` unchanged in the approved read-only SQL client (for example, the Render-linked `psql` session). It contains only `SELECT` statements against `information_schema` and `pg_catalog`; it does not apply a migration, create a function, write rows, or inspect customer rows.
- [ ] Review all result sets: prerequisite tables/columns, migration 031–035 tables/columns, numeric `(18,6)` properties, constraints, and triggers. `MISSING`, `MISMATCH`, `NOT_VALID`, or `DISABLED` is a release blocker until the owner explains it and the checklist is updated.
- [ ] Run the preflight once before the ordered release to record the target's baseline, then run it again after 031–035 commit. Before release, missing 031–035 objects can be the expected pending state; after release, every expected row must be `OK`. A partial or unexpected state is drift—stop and escalate rather than guessing which migration ran.
- [ ] Save the read-only output with the release record. The preflight checks schema metadata only; it does not certify legacy values for migration 032's lossless conversion. Use the backup and development rehearsal gates above for data-conversion safety.

## Ordered release

- [ ] Routing release additionally requires additive migrations **036 → 037 → 038** before this application version starts. Migration 038 adds only per-branch routing; it does not assign a default kitchen, populate people, or change stock. An unconfigured kitchen permits requests and alerts eligible operations managers.
- [ ] 038 was applied only to the Replit development database with the database skill. The external Render/Supabase production schema remains an operator deployment prerequisite; it was not modified. Do not assume Replit Publish migrates an external database.
- [ ] Verify `central_kitchen_routing` foreign keys and distinct-person constraints; configure responsible/deputy/receiver explicitly after deploy. Existing open orders use current routing, not historical inferred assignments.
- [ ] Overdue notifications use the Saudi needed date/time (07:00 when time is absent), only for open orders, with one stable notification key per order. Closed historical orders are excluded.

- [ ] Review and apply **031 → 032 → 033 → 034 → 035** in order; do not skip or concatenate migrations.
- [ ] Verify each migration commits once and the next migration starts only after the previous one succeeds.
- [ ] For Replit-managed databases, use the approved Publish flow for production schema changes. **Do not run `db:push` as a release step**, and do not perform direct production DDL.
- [ ] Record the applied state and release owner after completion; stop and escalate any drift or failed step.