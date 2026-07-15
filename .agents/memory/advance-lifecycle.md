---
name: Advance (سلفة) lifecycle
description: Signed-consent lifecycle for employee advances and its invariants
---
Status machine: pending → (pre_approved) → awaiting_signature → signed → approved → disbursed. Final approval is ONLY allowed from `signed` and atomically creates N equal salary_deductions installments (last absorbs rounding) linked via advanceRequestId. Legacy advances bypass signature (entered directly approved, installments for remaining amount only, isLegacy flag).

**Why:** Advance is a binding financial commitment — the employee must sign an official consent (ack checkbox + drawn signature) before any deduction rows exist; re-sending for signature must clear prior signatureData/signedAt.

**How to apply:**
- Final-authority is role-based (`hasAdvanceFinalAuthority`: admin/super_admin/hr_manager, hr_specialist needs edit perm) — the HR advances page must mirror this exact logic for `canFinal`, NOT just `hasPermission("hr_advances","edit")`, or ops managers see 403-doomed buttons.
- Installment plan math (equal, last absorbs rounding) exists in both server helper and the portal signer preview — keep them in lockstep.
- Employee cancel allowed only while pending/pre_approved/awaiting_signature; sign route needs ownership check + atomic status guard.
