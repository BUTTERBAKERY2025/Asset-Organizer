# Central-kitchen migration release checklist

## Blockers and prerequisites

- [ ] Confirm the authorized target (including any external target), its currently applied migration state, and schema drift. Unknown target state blocks release.
- [ ] Confirm a current backup and a tested restore path before any schema change. Missing backup confirmation blocks release.
- [ ] Rehearse the canonical SQL in development or an isolated disposable transaction/schema and record the result.

## Ordered release

- [ ] Review and apply **031 → 032 → 033 → 034 → 035** in order; do not skip or concatenate migrations.
- [ ] Verify each migration commits once and the next migration starts only after the previous one succeeds.
- [ ] For Replit-managed databases, use the approved Publish flow for production schema changes. **Do not run `db:push` as a release step**, and do not perform direct production DDL.
- [ ] Record the applied state and release owner after completion; stop and escalate any drift or failed step.