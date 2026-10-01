---
name: Operations HR boundary
description: User-confirmed employee scope and nonblocking payroll review for operations managers.
---

Operations HR includes all employees of explicitly permitted branches, excluding general administration/HQ. Do not require a department assignment or infer eligibility from job title.

**Why:** The user explicitly chose all employees in permitted branches rather than a separately assigned operations department.

**How to apply:** Keep this intersection on reports, exports, joining actions, and transfers. Both source and destination must be permitted for operations transfers. Opening the HR center must not grant general HR administration.

Payroll review by the operations manager is advisory and must never block HR approval or payroll closing.

**Why:** The user explicitly chose optional review so HR can continue without it.

**How to apply:** Keep review permission distinct from closing authority; describe review records as advisory, not as final payroll approval or proof that later-changing live amounts were approved.

Printed/exported operations payroll reports must identify Operations as their issuer and distinguish review copies from HR's final payroll approval, including when their data comes from a closed snapshot.

**Why:** The user explicitly requires this distinction so an operations-exported paper cannot be mistaken for the final HR payroll document.

**How to apply:** Repeat a discreet Operations review-only watermark and disclaimer on every PDF page; identify the full branch/month scope and source state in every export format.

Scoped payroll review/export, joining-link creation and signed-joining approval, and employee transfer are baseline operations-manager capabilities, not optional hidden tools.

**Why:** The user explicitly authorized these capabilities after screenshots showed the role could open the center but was denied its required workflows. Their requested authority is over all employees and accepted-offer recruits in explicitly permitted branches, not company-wide HR administration.

**How to apply:** Keep existing branch grants unchanged (zero grants means zero branches), exclude HQ, and preserve HR's final financial and employee-conversion authority. Joining approval must notify authorized HR management and link to the exact record; a missing recipient must be explicit, not a silently lost notification.

Operations payroll must expose the same substantive detailed report as HR salary closing, including attendance and check-in/check-out evidence, not a reduced gross/net summary.

**Why:** The user rejected the summary as incomplete and explicitly requested the actual HR salary report within the manager's granted scope.

**How to apply:** Reuse the authoritative calculation and closed snapshots, retain detailed financial and attendance visibility, but never infer HR editing or financial closing authority from report access.

The default Operations payroll review PDF must be compact like the screen table: one row per employee and concise authoritative totals, not an individual detail dossier for each employee.

**Why:** The user rejected a 39-page review PDF for 18 employees and explicitly requested a short screen-like report. This changes PDF presentation, not the requirement for substantive report data.

**How to apply:** Keep full branch/month scope, readable RTL rows, unknown-versus-zero and warning indicators, and the review-only watermark. Leave full dates, itemized deductions and payment transaction details in the source report and Excel/CSV, without recalculating salary totals.

Ordinary joining-link resend is a retry, not an instruction to invalidate an existing valid link. Explicit replacement is a separate intent, and all send surfaces must respect signing/confirmation state.

**Why:** Automatic replacement on every retry can send a link that a simultaneous request has already revoked. A provider failure after link creation does not mean creation failed.

**How to apply:** Keep link generation distinct from channel delivery feedback. A conflicting notification on another branch should prompt HR coordination without revealing its private details or offering an impossible second creation.