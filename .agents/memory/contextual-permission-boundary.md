---
name: Contextual permission boundary
description: Phase-two security decisions and deployment limits for scope-aware permission resolution.
---

Keep action and scope in one decision. Navigation unions are display-only; never authorize data by combining a flattened action list with an independent branch list.

**Why:** Existing branch-view access previously amplified actions from a different assignment. An unknown resource context cannot establish that a scoped permission or deny applies.

**How to apply:** Route-owned persisted-resource context and actual collection filtering are required for scoped grants. Unadapted routes fail closed; explicitly review their legitimate workflows before activating the new resolver. See docs/governance/phase2-contextual-permissions.md.

Review custom permission helpers and aggregates as well as standard route guards when expanding branch-template coverage.

**Why:** A fresh but flattened grant lookup can bypass a scoped replacement, and checking an aggregate afterward cannot recover which branches contributed to it.

**How to apply:** Feed custom guards the same resource-context decision; filter source rows before aggregation. Test with nonzero contributions from both an allowed and a denied branch.

Intentional empty direct replacement is not a request to inherit, manufacture permanent deny overrides, or erase independent denies.

**Why:** Synthesizing omission-denies while switching to direct mode prevented later explicit restoration; erasing denies on checkbox changes undid independent restrictions.

**How to apply:** Persist source mode in the same transaction as every replacement, including delegated paths. Preserve independent overrides. Legacy accounts must not be bulk-assigned a source mode. Keep migration 050 and compatibility review as explicit deployment prerequisites; old-code rollback can revive empty-direct inheritance.

Do not infer permission-label aliases from similar UI names, especially a broad historical label such as reports.

**Why:** A historical deny label can differ from endpoint guard modules. Automatically applying it across all report-producing modules would expand its meaning and may block unrelated authorized work.

**How to apply:** Separate tuple/source correctness from policy-name coverage. Document proposed mappings and obtain policy approval before changing their meaning; aggregate inventory alone is not per-account HTTP evidence.

كل تقرير لابد أن يكون له صفة توضّح نوعه، مثل تقارير المبيعات وتقارير الإنتاج.

**Why:** المستخدم أوضح هذا التوجيه عندما لم يفهم الاختيار بين منع «التقارير» المركزية ومنع جميع تقارير الأقسام؛ لم يختر أحد الخيارين.

**How to apply:** سمِّ التقارير والصلاحيات بحسب مجالها عند إعداد المطابقة. هذا توجيه للتصنيف والتسمية، وليس موافقة على توسيع المنع العام القديم أو تغيير الحسابات.