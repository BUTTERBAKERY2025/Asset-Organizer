---
name: Production evidence boundaries
description: Avoid attributing custom-domain Render failures to unrelated Replit deployment evidence.
---

The custom-domain live service has been hosted on Render with Supabase, while Replit publishing metadata has referred to a separate deployment. Verify the current mapping before using any deployment logs as incident evidence.

**Why:** Successful local requests and a healthy Replit deployment did not explain intermittent gateway failures on the external service. A successful mutation can also precede failing refresh requests; testing only the mutation misses that distinction.

**How to apply:** Read the affected production state without changing it, separate mutation completion from subsequent reads and background work, and match runtime evidence to the actual hosting service. Do not describe a defensive change or passing local test as a proven gateway-outage fix.

On 2026-10-02 the user confirmed checking Render settings and that the live site's database matches the Supabase target documented in docs/live-runtime-identity.md.

**Why:** This is owner-confirmed deployment knowledge, not inferable from local code or an MCP connection.

**How to apply:** Treat database identity as owner-confirmed for this review; do not ask the same question again without conflicting evidence. Do not extend that confirmation to the deployed code revision or runtime correctness.

Do not assume a Supabase development branch automatically reproduces this project's live schema.

**Why:** An authorized schema-only branch reached MIGRATIONS_FAILED with zero public application tables. The production migration ledger did not show a base users-table definition in the checked statements. A functioning existing production database does not prove its recorded migrations can initialize an empty one.

**How to apply:** Prepare and validate a complete schema-only baseline before paying for another branch. Verify actual table readiness before attempting application startup, keep test connection credentials distinct, and delete only the disposable branch after the attempt. Never merge/reset the main branch to repair a test environment.

Use the independently owned local PostgreSQL test path before paying for cloud staging again.

**Why:** PostgreSQL was already available locally; a disposable cluster let real startup/authentication checks run without cloud credentials or production service access. Node/pg returns inet_server_addr()::text with a subnet suffix, so literal socket proof must normalize with host() rather than reject its own cluster. Node listen may also look up literal IPs.

**How to apply:** Keep identity/ownership proof fail-closed, normalize only actual literal addresses, and permit no hostname lookup just to accommodate loopback listeners. Test-only dependencies must stay lazy in normal CJS builds; unconditional createRequire(import.meta.url) breaks production even when test mode is off. See docs/governance/isolated-runtime.md for limitations.

Existing tests labelled “development” are not proof of a disposable target.

**Why:** Some legacy suites reject known production-provider URL patterns but still mutate the selected configured database. Such a heuristic cannot independently establish isolation, including when USE_SUPABASE changes connection precedence.

**How to apply:** Prefer mocked queries or the owned local-cluster launcher for security regression work. Inspect DB imports before running older suites; never treat a passing production-name denylist as target ownership proof.