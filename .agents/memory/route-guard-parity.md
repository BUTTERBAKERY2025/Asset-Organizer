---
name: Route guard parity
description: How to add requirePermission to previously auth-only routes without breaking access
---
Rule: when hardening an isAuthenticated-only route, guard it with the SAME module that gates the consuming client page (see ModulePage/AdminPage routes in client/src/App.tsx), not the module the data "belongs to".

**Why:** guarantee was "no one loses access". A route consumed by two differently-gated pages (e.g. visitor stats used by both the visitors page and executive reports) needs an either-module guard, or one page silently breaks.

**How to apply:**
- Legacy accounting endpoints are gated by the `integrations` module (their only consumer page).
- Routes with internal admin checks (isUserAdmin) or branch-scope filtering (getEffectiveBranchFilter/getAllowedBranchIds) and all /api/my-* self-scoped routes are deliberately left auth-only.
- For either-module needs, wrap requirePermission with a fake-res fallback middleware (see /api/visitor-stats).
