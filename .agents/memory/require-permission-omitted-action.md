---
name: requirePermission omitted-action semantics
description: Omitted actions must be inferred before intrinsic role grants and explicit permissions.
---

Many routes call `requirePermission(module)` with no action. Infer the action from the HTTP method before evaluating role-map shortcuts as well as explicit permissions. Module presence must not authorize an action absent from the role's allowed actions. Preserve the administrator's existing full access.

**Why:** Granting on bare module presence over-grants writes to view-only users; isolated tests also demonstrated a specialist deleting a document despite lacking delete. Hard-denying every omitted-action call instead silently blocks legitimate reads.

**How to apply:** Never restore "module presence = access" in either intrinsic grants or the explicit fallback. If a POST route is semantically a read/export, pass an explicit action (e.g. `requirePermission("x", "view")`). Test role-map users as well as direct-grant users: view-only must pass GET and get 403 on writes, with legitimate write grants preserved.

Custom fresh-permission resolvers must preserve hard role restrictions before evaluating persisted grants, including in assignee eligibility.

**Why:** Fresh database grants are not equivalent to effective authority. Persisted grants can exist for restricted roles; maintenance implementation review exposed that reading them directly bypassed the standard viewer read-only and attendance-clerk module restrictions.

**How to apply:** Compare custom authorization with the standard middleware's role exclusions, not just its grant lookup. Test restricted roles with deliberately overbroad stored grants for reads, writes, transitions, and attachments.

Fresh authorization must also retain the full effective-permission pipeline: merged direct grants, role-assignment fallback, and active allow/deny overrides. Reading a single direct grant is not a safe shortcut.

**Why:** A second maintenance review exposed that explicit deny overrides could be ignored even after hard-role checks were restored; legitimate role-assignment-only users were also denied.

**How to apply:** Reuse the authoritative uncached resolver rather than duplicating a partial lookup, and exercise deny overrides and role-assignment-only access in endpoint tests.
