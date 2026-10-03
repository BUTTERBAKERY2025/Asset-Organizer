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

Scoped template selection now admits **cashier_journal, quality_control,
branch_stock, maintenance, branch_complaints, cashier_performance,
smart_incentives_challenges, smart_incentives_commissions,
smart_incentives_bonus, smart_incentives_wallet** and the existing view/navigation
modules **platform_home, dashboard, cashier, incentives**, or empty templates.
Navigation modules do not confer their underlying APIs' different permissions.
It also admits **branch_supply, central_kitchen_orders, branch_workforce** and
**delivery_tasks**. Delivery requires an existing employee/driver identity;
assignment does not mutate the job title or relax assigned-driver ownership.
Modules outside the reviewed vocabulary remain explicitly excluded with
BRANCH_CONTEXT_NOT_SUPPORTED until their HTTP resource contexts and collection
filters are verified. This is not support for every existing approved template.
Templates mixing supported and unsupported modules are excluded whole, never
silently truncated.

Explicit contexts currently cover journal list/filter/stats/report, journal
creation and journal-ID resources, quality list/create/detail, and stock desk
list/count, maintenance and complaint resources/attachments, cashier performance
reads (including shift targets, average ticket targets and alerts), incentive
collection reads and branch-filtered points aggregation. Home sales/production
summaries authorize contributing branches before aggregation instead of consulting
a flattened whole-account permission.
The maintenance and complaint custom guards use the contextual resolver for
scoped accounts; an ordinary global permission lookup cannot authorize those
requests. Workforce selects its guard using the requested branch, then verifies
each employee/schedule. Supply transfer resources resolve the persisted destination,
and kitchen order resources resolve the persisted requesting branch. Source
warehouse/production actions retain their separate guards. Transfer route selection
uses the requested branch or persisted source/destination rather than the union of
all module names on the account. This preserves an existing warehouse grant in
another branch when branch-supply authority is added locally. Unknown routes receive
no invented branch. They can only use legacy
base actions common to every replacement; new branch grants are not flattened.
Consequently unsupported unscoped operations may be denied after a restrictive
branch assignment, even though their original outside-branch grants remain stored.
Further route adaptation is required for full behavioral parity.

Daily-closure list/preview/create/detail/close/delete routes now resolve branch
contexts, retaining their existing financial policy (including admin-only
deletion and separation of duties). Daily-production batch list, unfinished
list, create, detail, update, delete, finish, carry-over and reschedule resolve
the persisted source branch where applicable. Lists explicitly filter the
entire allowed branch set, not just singleBranchId. This does not add either
module to delegated template vocabulary or certify all production endpoints.

The bulk cashier-target writer and shift-performance collection now also resolve
their branch candidates before authorization. The bulk writer validates every
target against the resulting branch constraint before inserting anything, so a
mixed allowed/denied batch cannot partially succeed. These two adaptations do
not certify the remaining sales or shifts routes.

## Release

1. Review and apply migrations/056_branch_employee_template_assignments.sql
   manually on the intended database. No production migration was applied here.
2. Deploy frontend/backend together. Before 056, previews return an explicit
   migration-required response. Existing accounts have no automatic assignments.
3. The owned isolated runtime test below exercises real login, HTTP handlers,
   SQL persistence and the migrated table. Production activation remains a
   separate deliberate release; no automatic activation is included here.
4. Do not roll back to old auth code after assigning scoped templates: old code
   ignores these bindings and could revive removed rights. Do not drop the table
   as a rollback. Transfer/link drift fails closed and requires administrator
   review; it never silently discards historical authority.

## Verification

Pure resolver and mocked API regression tests cover independent branches,
unknown scope, retained denies, intentional empty replacement, foreign branch,
withdrawn manager grant, stale revision, protected role, disabled policy, missing
migration and writes confined to scoped metadata/audit.

Run the database-backed verification without configured database credentials:

    node scripts/isolated-test/ephemeral.mjs --smoke tests/isolated-runtime-branch-templates.mjs

The launcher creates and attests ownership of a fresh local PostgreSQL cluster,
installs the offline baseline and synthetic fixtures, and destroys it afterward.
The test applies migration 056 and the delivery workspace's ordered manual schema
dependencies only after re-proving that same connection.
It exercises cross-branch reads, new versus retained rights, session revocation,
scope-filtered populated points totals, maintenance/complaint create and detail,
forged branch query parameters, kitchen rows/detail isolation, workforce branch
denial, supply desk reads, driver identity eligibility and management denial,
simultaneous same-revision saves (200/409),
transactional rollback on an injected audit failure, and manager-grant withdrawal.
No production migration or deployment was performed.

The isolated test also replaces the branch base a second time, removing performance
from branch A, then proves branch B targets and home sales remain readable.
It seeds nonzero sales in both branches and checks aggregate and top-branch outputs,
including explicit denied-branch queries and forged resource query parameters.

The same isolated test now checks retained bulk-target creation in branch B,
rejection of mixed B/A and B/foreign batches with unchanged row counts, and
populated shift-tracking results containing only branch B.

It also verifies populated production and closure reads, closure totals,
persisted-owner checks against forged queries, retained production edits and
closure approval in B, denied mutations in A, and unchanged admin-only closure
deletion. With A restricted and both B/C retained, production and unfinished
lists must return B/C only. This third-branch case catches accidental
singleBranchId=null → unfiltered queries.
It also seeds an outbound transfer from the retained warehouse branch and a
restricted transfer, verifying both list filtering and persisted-resource decisions.
The linked account's default branch deliberately differs from the canonical
employee branch: explicit branch bindings work without rewriting that default.

Commission edits and achievement recording also use persisted branch ownership,
including the additional authority needed to record for another cashier.
Cross-branch reclassification of an existing incentive record is rejected.
The transfer and kitchen-supply UI selects its permission module using the
selected branch's projection, not the navigation union. The isolated test
checks that this projection returns supply authority for A and the retained
warehouse authority for B.

Latest run: 84 isolated HTTP/database assertions and 125 targeted regression
tests passed. The application build passed with existing duplicate-key/member
warnings; this does not constitute a whole-project clean type check.