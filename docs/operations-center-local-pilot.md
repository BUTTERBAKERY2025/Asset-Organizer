# Operations center: local single-browser pilot

Use **only** the local development database (`DATABASE_URL` hostname `helium`, path `/heliumdb`); never point these commands at a published app, Supabase, or production. `NODE_ENV=production` and `USE_SUPABASE=true` are refused. No schema changes are performed. Keep the manifest outside the repository; it contains real passwords and must not be pasted into chat, logs, reports, screenshots, or git.

```sh
npx tsx scripts/dev-ops-center-pilot.ts --setup
npx tsx scripts/dev-ops-center-pilot.ts --status
```

Setup is idempotent against `/tmp/ops-center-pilot-credentials.json` and emits **only** account labels, IDs/usernames, branch IDs, order/item IDs, and counts. It creates namespaced branches A and B, distinct password-authenticated operations managers A (one explicit A grant) and B (one explicit B grant), and a zero-grant operations manager. The local database has no `maintenance_tickets` table, so the existing authoritative source fixture is one requested **shadow** central-kitchen order per branch, with a distinct `TEMP OPS PILOT` item; A's request uses B as its temporary kitchen and vice versa. No stock posting, payroll, sales, or production transaction is inserted. Existing users, grants, and branches are not changed. Fixture owner keys are in the protected manifest (mode 0600).

For the tester, retrieve the username/password pairs privately from `/tmp/ops-center-pilot-credentials.json` on this machine; do **not** send that file or its contents through the agent conversation. Normal app login is `POST /api/auth/login` with JSON `{ "username": "...", "password": "..." }` and a browser session cookie (not Clerk impersonation). After the development server is **already running**, verify real local password login (three independent sessions, cookies never printed):

```sh
npx tsx scripts/dev-ops-center-pilot.ts --verify-login
```

For a non-browser, real-session API journey against the **already running** local
port 5000, use `npx tsx scripts/dev-ops-center-pilot.ts --verify-center`. It
asserts scoped queue/export/source links, A/B/zero branch boundaries, forged
branch switching, then revokes only the fixture A grant to assert denial in
the existing session and invalidation of its SSE stream. It restores the
grant in a `finally` block, even when an assertion fails. Only assertion
labels/statuses are printed, not passwords, cookies, or response payloads.
The normal login endpoint permits five attempts per IP per 15 minutes; if
it returns HTTP 429, wait for its rate-limit window (do not reset the server
or bypass the limiter).

Use two separate browser profiles or log out via `POST /api/auth/logout` between accounts. Visit `/operations-center`; the data API is `GET /api/operations-center?branchIds=all` (or `?branchIds=<A or B branch ID>`). Confirm A sees its A `kitchen_order` queue item and exact source link `/central-kitchen-orders?stage=requested&branchId=<A branch ID>&orderId=<A order ID>` but cannot request B's queue; repeat inversely as B. Confirm the zero-grant account receives no branch data. Note kitchen destination is the *other fixture branch*; compare the queue item `branchId`/`sourceId` against the printed order IDs rather than asserting the kitchen module itself is isolated by request branch. The opposite operations-center branch request should return 403 (or a denial response), never its queue content.

For revocation testing, use the guarded fixture commands to remove **only** A's manifest grant ID (printed as `users.A.grantId` by `--status`), then restore that same row ID. These commands are idempotent and never modify another user's grant:

```sh
npx tsx scripts/dev-ops-center-pilot.ts --revoke-a
# Refresh A's session and confirm denial/no stale A data.
npx tsx scripts/dev-ops-center-pilot.ts --restore-a
```

Do not transition orders, add events/items, make other grants, or create records against fixture branches/accounts. To clean up after testing:

```sh
npx tsx scripts/dev-ops-center-pilot.ts --cleanup
```

Cleanup checks namespaced ownership and deletes only manifest-keyed fixture rows and the three fixture accounts' sessions/audit records. It refuses unexpected order events, changed ownership, or foreign references; investigate these manually rather than broad-deleting data. The manifest remains on cleanup failure for recovery. Never run `db:push` for this pilot.

## Pilot HTTP verification outcome (fixture subsequently cleaned)

The guarded local API journey reached both A and B accounts before the normal
`/api/auth/login` IP rate limiter returned HTTP 429 on the zero-grant login
(five logins per 15 minutes). Both manager sessions passed these assertions:
real password login and `/api/auth/me` identity; own operations-center scope
and exact `kitchen_order` queue item; exact source link with `orderId`; `all`
limited to the single granted branch; opposite-branch 403; forged active
branch 403; own export limited to the one branch; opposite-branch export 403;
and exact own `/api/central-kitchen-orders/:id` detail. An earlier standalone
`--verify-login` also verified all three identities through real HTTP sessions.
The follow-on **zero-grant center denial, same-session revocation, SSE
invalidation, and restore-after-revocation assertions were not reached**;
this is not evidence that those checks pass or fail. No SQL/application 5xx
was observed in the executed assertions. The first journey encountered only
a test-scaffolding link expectation error: the real source link correctly
includes `orderId`; the expectation was updated accordingly.

Per stop request, no more login attempts or waits were made. The fixture A
grant was explicitly restored and `--cleanup` completed successfully,
removing all three accounts, both branches, both orders and items, and the
manifest. There are currently no pilot credentials/fixtures to reuse;
run `--setup` to stage a new pilot if separately authorized.