# Branch-template isolation — preparation, not an active feature

The owner approved independent branch template assignment without modifying
authority in other branches. The existing account-wide assignment endpoints
must not be unguarded: they replace `user_permissions` globally.

## Prepared in this change

- Manual additive migration 056 defines a separate `(user_id, branch_id)`
  assignment. It does not backfill, modify grants, or replace migration 053.
- `server/branch-template-decision.ts` defines and tests contextual base
  replacement. Independent overrides remain independent. Original authority in
  other branches remains unchanged; scoped additions never become global grants.

**Neither the table nor the decision helper is wired into runtime. Do not
describe this as completed branch assignment or ask an operator to apply 056
as a fix. No production migration has been run.**

## Required before activation

1. Audit every consumer of each eligible template module, including handlers
   using flat permission reads instead of `requirePermission`. Add persisted
   resource context and actual collection scope filtering; a client branch
   parameter alone is not proof of resource ownership.
2. Load approved historical branch bases into the fresh authorization snapshot.
   Validate employee linkage, approval and unique account/branch binding.
   Missing or malformed authority must fail closed, not silently inherit.
3. Add transactional, revision-checked branch assignment preview and apply.
   Re-check current writable manager branches inside the write transaction.
   Do not delete direct permissions, source modes, other branch assignments,
   independent overrides or legacy account-wide bindings.
4. Expose per-action directory capabilities. Branch template assignment must
   not imply permission to freeze, reopen, reset or otherwise change the entire
   account. Keep protected roles and self-management protections.
5. Show branch-specific before/after, unchanged outside authority, historical
   assignment, independent additions and actionable migration errors in the UI.
6. Test two branches with different templates, an out-of-scope branch, legacy
   authority, empty templates, denies, expired permissions, transfer/link
   changes, concurrent previews and stale actor grants on an owned isolated DB.
   Exercise actual endpoint filters and authenticated UI, not only pure helpers.
7. Prepare an explicit rollout/rollback procedure. Old code ignores branch
   replacements, so rollback after real assignments requires review before
   removing this feature. Do not drop authority tables as a routine rollback.

The current helper is intentionally not enabled until those checks are complete.
The existing `EXTRA_BRANCH_AUTHORITY` protection remains unchanged.