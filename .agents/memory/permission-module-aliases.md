---
name: Permission module aliases
description: Historical module-name synonyms accepted by runtime auth and how to represent them faithfully
---
Runtime `requirePermission` accepts historical module synonyms, and the directions matter:
- Direct user grants: `attendance` → also satisfies `attendance_check` (one-way); `pnl` ↔ `pnl_dashboard` (bidirectional).
- operations_manager auto-grants: `attendance`↔`attendance_check`, `quality`↔`quality_control`, `waste`↔`waste_tracking`.
- financial_manager auto-grants: `pnl` ↔ `pnl_dashboard`.

**Why:** `attendance` and `attendance_check` are two REAL distinct modules (reports vs clock-in page) — collapsing aliases to one canonical name misrepresents access. Any "effective permissions" computation must MIRROR grants across the pairs per the applicable direction/source, not merge module names.

**How to apply:** when displaying or auditing what a user can actually do, replicate these synonym rules from `server/auth.ts` (operationsManagerActionsFor, financialManagerActionsFor, direct-grant fallbacks) or the UI will under/over-report vs real route behavior.
