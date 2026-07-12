---
name: requirePermission omitted-action semantics
description: How single-arg requirePermission(module) calls are authorized for explicit-permission users
---

Many routes call `requirePermission(module)` with no action. Role-map branches (hr_manager, hr_specialist, financial_manager) intentionally grant on module presence when action is omitted. For the explicit user_permissions path, the omitted action is inferred from the HTTP method (GET/HEAD/OPTIONS→view, POST→create, PUT/PATCH→edit, DELETE→delete, unknown→edit).

**Why:** Granting on bare module presence over-grants writes to view-only users (broken access control, caught in review 2026-07). Hard-denying every omitted-action call (the old accidental behavior via `includes(undefined)`) silently blocked explicit-perm users from all single-arg routes.

**How to apply:** Never change the explicit-permission fallback to "module presence = access". If a POST route is semantically a read/export, pass an explicit action (e.g. `requirePermission("x", "view")`) instead of relying on inference. Regression matrix: user with module + actions=["view"] must pass GET and get 403 on POST/PUT/PATCH/DELETE.
