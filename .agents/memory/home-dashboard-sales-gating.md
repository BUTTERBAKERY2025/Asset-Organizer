---
name: Home dashboard sales gating
description: Sales/production numbers on the home page must be permission-gated on BOTH frontend and the dashboard APIs, not by role.
---

# Home dashboard sales gating

The command-center home (`platform-home.tsx` hero "salesSummary" line + `hero-widgets.tsx`
sparkline / week-total / top-branch highlights) and its APIs `/api/dashboard/stats` and
`/api/dashboard/widgets` surface raw sales figures (todaySales, weekSales, topBranchToday).

These are NOT covered by sidebar/route module gating, so a role added later (e.g. hr_specialist)
will see sales on the home page even when every sales menu item is hidden.

**Rule:** gate sales surfaces by a sales-view capability, not by role:
`canViewSales = canView("cashier_journal") || canView("sales_analytics") || canView("cashier_performance")`.
Production highlight gates on `production:view`. Apply the SAME check on the server (via
`storage.hasPermission(uid, module, "view")`, which bypasses for admin) so the numbers are
omitted/zeroed in the API response, not just hidden in the DOM.

**Why:** frontend-only hiding still leaks the values in the network response (devtools).
**How to apply:** when adding any new role or auditing data exposure, check these 4 home surfaces
(2 UI components + 2 API endpoints) together — they drift out of sync easily.
