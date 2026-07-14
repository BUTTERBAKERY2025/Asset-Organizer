---
name: Advance requests two-stage approval
description: How the سلف (advances) approval pipeline works and its authority rules
---
Rule: advance_requests flow is pending → pre_approved (preliminary) → approved/rejected. Final approval atomically creates the linked salary_deductions row (type=advance, month=requestedMonth) inside one transaction and sets linkedDeductionId — never create the deduction outside that path or it double-deducts in salary closing.

**Why:** user required ops-manager preliminary approval scoped to his branches, HR final decision, and automatic entry into monthly salary closing.

**How to apply:**
- Final authority = admin/hr_manager, hr_specialist with hr_advances:edit, or explicit hr_advances:edit — computed server-side (hasAdvanceFinalAuthority in self-service-routes). operations_manager is HARD-blocked from final decision even if granted extra perms (intentional anti-escalation).
- Review route is guarded by requireAnyPermission("hr_advances", ["approve","edit"]) — bare requirePermission on POST would infer "create" and 403 the ops manager.
- ops template has hr_advances view/approve/export only; runtime role maps + /api/my-permissions merges expose it automatically (no per-user permission rows needed).
- Client "final vs preliminary" UI keys on hasPermission("hr_advances","edit").
- Employee may cancel while pending OR pre_approved.
- New columns pre_approved_by/at/note: idempotent ALTER in runStartupMigrations + migrations/020_advance_two_stage_approval.sql for manual Supabase run before Render deploy.
