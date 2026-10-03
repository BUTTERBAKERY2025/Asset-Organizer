# Independent branch-template assignment

## Implemented

- An additive, manual migration 056 creates a separate account/branch assignment.
  Existing 053 bindings, direct permissions and source modes are not rewritten.
- A fresh snapshot loads approved historical branch bases. The decision resolver
  replaces base authority only in the specified branch, retaining independent
  overrides. Other explicit branch contexts use their original base.
- The employee directory exposes branch-template assignment independently of
  whole-account management. Administrative roles, self-management, inactive
  employees, read-only manager branches and ambiguous account links remain denied.
- The new preview/apply endpoint rechecks current manager grants, policy, linkage,
  template approval/version and snapshot revision under locks. It writes only
  the branch binding and audit, and revokes target sessions transactionally.
- The UI reviews the selected branch, before/after base, independent overlays,
  reason and confirmation. Failed/stale saves require fresh review.
- Whole-account freeze/reopen and legacy global permission writes keep their
  original protections. Branch assignment does not imply those capabilities.

## Coverage limits — do not conceal

Scoped template selection currently admits **cashier_journal, quality_control,
branch_stock**, or empty templates. Other modules are explicitly excluded with
BRANCH_CONTEXT_NOT_SUPPORTED until their HTTP resource contexts and collection
filters are verified. This is not support for every existing approved template.
Templates mixing supported and unsupported modules are excluded whole, never
silently truncated.

Explicit contexts currently cover journal list/filter/stats/report, journal
creation and journal-ID resources, quality list/create/detail, and stock desk
list/count. Unknown routes receive no invented branch. They can only use legacy
base actions common to every replacement; new branch grants are not flattened.
Consequently unsupported unscoped operations may be denied after a restrictive
branch assignment, even though their original outside-branch grants remain stored.
Further route adaptation is required for full behavioral parity.

## Release

1. Review and apply migrations/056_branch_employee_template_assignments.sql
   manually on the intended database. No production migration was applied here.
2. Deploy frontend/backend together. Before 056, previews return an explicit
   migration-required response. Existing accounts have no automatic assignments.
3. Test real scoped accounts on an owned isolated database before production
   activation. Mock API tests and UI fixtures are not real database attestation.
4. Do not roll back to old auth code after assigning scoped templates: old code
   ignores these bindings and could revive removed rights. Do not drop the table
   as a rollback. Transfer/link drift fails closed and requires administrator
   review; it never silently discards historical authority.

## Verification

Pure resolver and mocked API regression tests cover independent branches,
unknown scope, retained denies, intentional empty replacement, foreign branch,
withdrawn manager grant, stale revision, protected role, disabled policy, missing
migration and writes confined to scoped metadata/audit.