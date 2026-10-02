# Phase 2 — read-only scope impact inventory

Observed 2026-10-02; assignment aggregate timestamp 16:48:37 UTC. **Aggregate inventory only; not release approval, a migration, or authenticated operational verification.**

## Evidence and safety boundary

- Supabase MCP target: the owner-confirmed project recorded in `docs/live-runtime-identity.md`. No alternate credentials or target were used.
- Five successful SQL calls: selected schema metadata, assignment/source aggregates, deny aggregates, assigned module/action aggregates, and totals. Every call used `BEGIN READ ONLY; SET LOCAL statement_timeout=4000; SELECT …; COMMIT;`.
- No production writes, migrations, deployment, workflow operations, environment access, account payloads, names, usernames, phone numbers, salaries, secrets, or raw identifiers were requested or recorded. IDs were used only inside joins/counts, never returned. No security warning or access error was reported.
- Aggregate results are separate transaction snapshots, not one atomic snapshot. Counts may change. Account counts across modules overlap and must not be summed.
- Route mapping below describes workspace code, not proof of the currently deployed revision. This inventory does not exercise production requests.
- The selected schema metadata confirms **`user_permission_source_modes` is absent**. Consequently these are **legacy source classifications**, not successful execution of the new resolver against production. Local Phase 2 code deliberately fails closed for non-admin permission reads without manual migration 050; this remains an independent release blocker. No attempt was made to create the table.

## 1. Which assignments actually supply inherited scopes?

Legacy selection is account-wide: any direct permission row with a nonempty actions array selects direct permissions; assignments are not merged into that base. Empty direct rows alone do not select direct under the legacy interpretation.

| Role category | Assignment scope | Accounts / assignments | Nonempty direct rows | Time |
|---|---|---:|---:|---|
| employee | branch, branch identifier present, no department | 1 / 1 | 16 | current |
| employee | branch, both branch and department identifiers present | 7 / 7 | 43 | current |
| employee | global, neither identifier present | 2 / 2 | 60 | current |
| operations_manager | global, neither identifier present | 1 / 1 | 37 | current |
| admin | global, neither identifier present | 1 / 1 | 0 | current |

Totals: **12 assignments; 11 distinct assigned accounts with nonempty direct permissions; 8 branch assignments and 4 global assignments.** All assignments are active and currently within their start/end bounds. The seven branch-plus-department assignments span one distinct branch and two distinct departments; the branch-only group spans one branch. These are counts, not identifiers or organizational membership evidence.

**Actual inherited scoped-grant impact for non-admin: zero in this snapshot.** All eight branch assignments are suppressed by their account's nonempty direct base. The sole account classified as legacy inheritance is admin with a global assignment; the preserved admin bypass means it is not a newly scope-constrained workflow.

Do not infer that every account without direct rows has useful inherited grants: this inventory joins actual assignments. Do not convert the eleven mixed-source accounts to inheritance or merge their stored assignment scopes into direct permissions.

### Stored, currently suppressed scoped modules

These are potential future scope consumers, **not currently effective inherited grants**:

| Stored module | Branch-only account actions | Branch + department account actions |
|---|---|---|
| cashier | view/create/edit/approve/export | view/create/edit/approve/export (7 accounts) |
| dashboard | view | view (7) |
| inventory | view | view/create (7) |
| reports | view/export | view/export (7) |
| construction | — | view/create (6) |
| production | — | view/create (6) |
| quality | — | view/create (6) |
| waste | — | view/create (6) |

Role-permission scope JSON is non-null for some cashier/dashboard/inventory/reports rows in these suppressed groups. Its content was not retrieved. The new storage snapshot uses assignment scope identifiers, not this JSON; no additional effective scope is inferred from its mere presence.

## 2. Explicit denies and intrinsic role grants

There are **196 deny rows across 10 distinct accounts**; all are currently effective by expiry, global (no branch or department identifier), and none is an allow override. Duplicate rows/permission definitions mean row count is not a count of unique account/module/action decisions.

| Role category | Stored module | Denied actions (union) | Deny rows | Accounts | Rows matching a direct action |
|---|---|---|---:|---:|---:|
| employee | cashier | view/create/edit/approve/export | 30 | 6 | 0 |
| employee | construction | view/create | 20 | 5 | 0 |
| employee | dashboard | view | 2 | 1 | 0 |
| employee | inventory | view/create | 36 | 9 | 4 |
| employee | production | view/create | 30 | 7 | 0 |
| employee | quality | view/create | 20 | 5 | 0 |
| employee | reports | view/export | 20 | 9 | 2 |
| employee | waste | view/create | 20 | 5 | 0 |
| operations_manager | cashier | view/create | 4 | 1 | 0 |
| operations_manager | construction | view/create | 4 | 1 | 0 |
| operations_manager | quality | view/create | 4 | 1 | 4 |
| operations_manager | reports | view | 2 | 1 | 2 |
| operations_manager | waste | view/create | 4 | 1 | 4 |

All deny rows belong to accounts with some nonempty direct base. The direct matching count checks the same action and the decision engine's attendance/pnl directional aliases; it is **not** a usage measurement.

Workspace intrinsic policy (`server/auth.ts`, `shared/schema.ts`):

- The operations-manager account has intrinsic grants for **quality:view/create, waste:view/create, reports:view**. These overlap **10 stored deny rows / five distinct module-action pairs**. The same pairs also have direct grants; **none is intrinsic-only** in this inventory. Explicit deny must still win over both sources.
- Its cashier and construction denies do not match intrinsic modules of those exact names. `cashier_journal` is a separate intrinsic module; it must not be silently treated as `cashier`.
- The employee role has no general intrinsic grant for these denied modules. The narrow delivery-employee intrinsic grant concerns `delivery_tasks`, which does not occur in this deny inventory; no job-title data was needed or read.
- There are **zero scoped deny rows**. Therefore no currently observed deny requires branch/department resource context to avoid a conservative unknown-context rejection.

## 3. Route-family mapping and semantic blockers

Stored legacy labels must not be assumed to equal the endpoint guard. `permissionModuleMatches` in `server/permission-decision.ts` mirrors attendance/pnl aliases only; it does **not** map the mismatches below. Operations-manager intrinsic aliases do not rewrite explicit deny tuples.

| Stored family | Workspace route examples / actual guard | Inventory consequence |
|---|---|---|
| inventory | `/api/inventory`, `/api/inventory/:id`, import, accounting exports; `inventory` (`server/routes.ts`) | Exact match. Four employee deny rows overlap direct actions. Before any future inherited scope activation, add persisted asset branch context and collection filtering; current snapshot supplies no effective scoped inheritance here. |
| production | `/api/production-orders`, `/api/advanced-production-orders`, `/api/daily-production/batches`, finished-goods routes; `production`; also kitchen shipping/execution modules | Exact match on these guards. Thirty employee deny rows; no direct-action overlap. Future scoped grants require trustworthy order/batch branch context, not body/query assertions. |
| cashier | `/api/cashier-journals` and journal reports; `cashier_journal` | Legacy `cashier` denies do not automatically govern `cashier_journal`. Confirm intended policy before declaring cashier-family deny coverage; do not auto-convert records. |
| construction | `/api/construction/projects`, field checklists/hub; `construction_projects` | Legacy `construction` denies do not automatically govern `construction_projects`. Policy/mapping review remains required. |
| quality | `/api/quality-checks`; `quality_control` | The operations-manager intrinsic policy grants both labels, but a stored `quality` deny does not match a `quality_control` request in the decision engine. Must resolve intended deny semantics and test both labels before claiming quality-family denial. |
| waste | `/api/waste-reports`, analytics/items; `operations`; waste-risk routes use `production` | Neither `waste` nor `waste_tracking` denial is automatically a denial of `operations` or `production`. Must establish the intended route-specific boundary before claiming waste-family denial. |
| reports | `/api/reports/branch-overview`, executive summary use `operations`; payment-mismatch and cashier-journal report use `cashier_journal`; production reports use `production` | Intrinsic `reports:view` overlaps explicit deny, but these concrete report guards are other modules. Review report-family coverage without turning a general report deny into an unapproved global operations deny. |
| dashboard | `/api/dashboard/stats`, `/api/dashboard/widgets` are registered with authentication, without a `dashboard` permission guard at registration | One employee account has stored dashboard:view denies. Additional handler restrictions must be assessed; inventory does not prove the module deny controls these responses. |

Route references are representative families, not an exhaustive endpoint/handler security audit. Source files for wider production consumers include `production-planning.ts`, `advanced-production-execution.ts`, `kitchen-warehouse-shipping-routes.ts`, and `production-operations-report.ts`.

## 4. Completion decision

1. **No additional module is proven to require a resource-context adapter solely to preserve currently effective non-admin inherited/scoped grants:** that observed set is empty, as is the scoped-deny set. Do not describe the eight stored branch assignments as eight active inherited workflows.
2. **Before claiming complete deny-family governance**, review/adapt the actual guarded families **cashier/journal, construction/projects, quality checks, waste/operations, reports and dashboard** identified above. They are semantic coverage gaps requiring explicit policy and isolated positive/negative tests, not permission to expand aliases, rewrite denies, or modify runtime in this task.
3. Exact-label intrinsic deny precedence requires isolated verification for **quality, waste and reports** on the operations-manager role. Direct overlaps also require denial preservation for **inventory and reports** on employees. The offline comparator worker may independently test these semantics; this document does not claim its results.
4. Keep the remaining suppressed scope families—**inventory, production, cashier, reports, construction, quality, waste and dashboard**—on the future adapter backlog before explicitly activating inheritance. Branch-plus-department grants require both trusted identifiers; no department may be guessed from a job title or text.
5. Manual migration 050, explicit deployment authorization, deployed-revision confirmation and authenticated operational verification remain separate prerequisites. HR resource-context implementation is an independent worker's scope and is not certified here.

**Outcome:** aggregate impact evidence obtained without runtime changes. No current scoped-inheritance compatibility blocker was found for non-admin accounts; missing source metadata and unresolved legacy deny-to-route semantics prevent a claim of Phase 2 production readiness.