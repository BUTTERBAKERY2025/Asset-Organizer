---
name: Waste governance engine (Display Bar & Waste)
description: How the waste alert/rule governance system is wired and the schema-free conventions it relies on.
---

# Waste governance

`waste_risk_rules` + `waste_risk_alerts` tables pre-existed but were DORMANT (CRUD routes
existed, but nothing inserted alerts and there was no UI). The engine lives in
`server/waste-governance.ts` and is triggered from PATCH `/api/waste-reports/:id` after a
report goes submitted/approved (non-blocking).

## Schema-free rule types
`waste_risk_rules.threshold_type` is a free-text column, so new rule kinds were added
WITHOUT any migration: `daily_waste_percent`, `repeat_days`, `shortage`, `approval_gate`.
**Why:** user requires being notified of any DB schema change + manual Supabase SQL before
Render deploy; reusing the text column avoids ALTERs. When adding more rule kinds, keep
using string values + dedup, don't add columns.

## Key conventions
- Daily waste% = waste reports `total_value` / `cashier_sales_journals.total_sales` * 100
  (same formula as the analytics route). Made-to-order categories excluded upstream.
- Alert dedup is app-level by ruleId+branchId+alertDate(+productName) on status=open.
  No DB unique index (would be a schema change). Edge: concurrent eval can double-insert.
- On a NEW alert, also insert a branch-targeted `system_notifications` row
  (autoSource="waste_governance") — in-system notification, NOT WhatsApp (user choice).
- approval_gate is enforced at approval time (not via alerts): PATCH waste-reports returns
  409 {requiresJustification,threshold,currentPercent} when day waste% exceeds gate and no
  `approvalJustification` in body; justification is appended to report `notes` (no new col).
  Gate selection: branch-specific overrides global, then STRICTEST (lowest threshold).
  Fail-CLOSED: if the gate check throws, return 503 and do NOT approve.

## Security gotcha (fixed)
The pre-existing waste-risk-rules PATCH/DELETE only checked branch access when
`rule.branchId` was truthy → non-admins could edit/delete GLOBAL (null) rules, and PATCH
did raw `.set(req.body)` allowing scope escalation (move rule to another branch/global).
Hardened: global rules are admin-only; PATCH whitelists fields; branchId moves are access-checked.
