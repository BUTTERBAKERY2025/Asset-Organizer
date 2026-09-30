# Operations manager PHASE1 branch scope migration

`operations_manager` now uses **only explicit `user_branch_access` rows**. Zero
rows means no branch access, not every branch. The previous role behavior (all
branches when rows were absent) is intentionally removed. Existing accounts
that relied on the implicit default will see an empty branch selector and
branch-scoped requests will be denied until an administrator explicitly selects
their authorized branches in user management. No migration, deployment hook,
seed, or runtime code auto-grants all branches or changes existing roles.

An administrator should review each existing operations manager and explicitly
assign only approved branch IDs. A stale active branch in a session will not
restore a revoked grant. Finance managers' organization-wide scope is unchanged.
The role's module actions are unchanged; this does not add payroll-closing access.

The legacy command-center aggregation only accepts a **single explicit branch**
for this role; requesting `all` or omitting `branchId` returns 400 rather than
querying every branch. The branch-scoped operations stats count actual finished
daily batches separately from planned order targets.

Authorization reads bypass server/API and service-worker response caches; browser
persistent-cache version and service-worker cache names are bumped to discard old
branch lists. A deployment needs a fresh service-worker activation on clients.
Review any other legacy route that queries all data without `canAccessBranch` or
`getEffectiveBranchFilter`: the shared scope helpers alone cannot constrain a
route that never calls them. Do not restore an implicit all-branches fallback.