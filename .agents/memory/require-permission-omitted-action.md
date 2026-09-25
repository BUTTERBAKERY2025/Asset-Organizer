---
name: requirePermission omitted-action semantics
description: How single-arg requirePermission(module) calls are authorized for explicit-permission users
---

Many routes call `requirePermission(module)` with no action. Role-map branches (hr_manager, hr_specialist, financial_manager) intentionally grant on module presence when action is omitted. For the explicit user_permissions path, the omitted action is inferred from the HTTP method (GET/HEAD/OPTIONS→view, POST→create, PUT/PATCH→edit, DELETE→delete, unknown→edit).

**Why:** Granting on bare module presence over-grants writes to view-only users (broken access control, caught in review 2026-07). Hard-denying every omitted-action call (the old accidental behavior via `includes(undefined)`) silently blocked explicit-perm users from all single-arg routes.

**How to apply:** Never change the explicit-permission fallback to "module presence = access". If a POST route is semantically a read/export, pass an explicit action (e.g. `requirePermission("x", "view")`) instead of relying on inference. Regression matrix: user with module + actions=["view"] must pass GET and get 403 on POST/PUT/PATCH/DELETE.

Custom fresh-permission resolvers must preserve hard role restrictions before evaluating persisted grants, including in assignee eligibility.

**Why:** Fresh database grants are not equivalent to effective authority. Persisted grants can exist for restricted roles; maintenance implementation review exposed that reading them directly bypassed the standard viewer read-only and attendance-clerk module restrictions.

**How to apply:** Compare custom authorization with the standard middleware's role exclusions, not just its grant lookup. Test restricted roles with deliberately overbroad stored grants for reads, writes, transitions, and attachments.

Fresh authorization must also retain the full effective-permission pipeline: merged direct grants, role-assignment fallback, and active allow/deny overrides. Reading a single direct grant is not a safe shortcut.

**Why:** A second maintenance review exposed that explicit deny overrides could be ignored even after hard-role checks were restored; legitimate role-assignment-only users were also denied.

**How to apply:** Reuse the authoritative uncached resolver rather than duplicating a partial lookup, and exercise deny overrides and role-assignment-only access in endpoint tests.
