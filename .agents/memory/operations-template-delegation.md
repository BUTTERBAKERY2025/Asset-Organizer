---
name: Operations approved-template delegation
description: User-approved general branch-template assignment, distinct from arbitrary raw permission grants.
---

The user directed: «ايضا كل قالب وليس فقط قالب الكاشير اي قالب يندرج تحت الفروع ال بيديرها مدير التشغيل المعين يمكن استخدامه انا محتاج انظم العمل».

**Why:** Admin-only visibility did not solve the actual workflow: operations managers need to create and update their selected employees' accounts using approved branch templates.

**How to apply:** Treat an approved, operations-delegable template version as authority for its supported complete base, independently of the old raw-permission checkboxes. Do not special-case template names or keys. Keep authorized writable branch, template approval, explicit application and the delegation enabled switch.

The user subsequently explicitly confirmed: «نعم، جميع موظفي فروعه الحاليين والجدد». Individual named employee selection is no longer an authorization requirement.

**Why:** The user wants existing and future employees under each operations manager's branches to follow the same organized template workflow.

**How to apply:** Derive coverage from fresh writable branch grants and active employee membership, not historic selections. Coverage does not create accounts or assign templates automatically. Allow ordinary unbound legacy branch-permission accounts to enter explicit template review; a broken existing binding is not legacy evidence. Administrative, multi-branch and unknown inherited/override authority stays protected.

A genuine template-backed account must remain manageable after assignment. This exception requires intact approval, account/employee/branch binding, explicit direct source, and exact equality with the assigned base; mere similarity to a template is not authority.

**Why:** Otherwise creating a broader approved base immediately makes its account unmanageable, while accepting arbitrary direct permissions would bypass delegation safety.

**How to apply:** Reconcile directory eligibility, assignment previews, subsequent changes and suspension/reactivation consistently. Unknown overrides, inherited roles and drifted bindings remain protected. Show excluded approved templates with reasons; a branch label alone cannot make a global permission branch-safe.

Authorization test doubles must represent the historical approved template content, not merely an assignment ID or the current mutable draft.

**Why:** Metadata-only mocks concealed the distinction between a genuine assigned base and an existing but invalid binding.

**How to apply:** Preserve historical content in test fixtures and verify proof-sensitive transitions against an owned real database, including drift made solely of otherwise permitted branch actions.

Keep journal submission compatibility confined to approved templates containing both explicit submit and create actions; do not translate submit into create or change live accounts to repair a comparison.

**Why:** The user approved fixing a blocked approved-template comparison without changing live account permissions. The journal submission endpoint still requires create; globally aliasing actions or changing that guard would change existing account behavior.

**How to apply:** Preserve exact template actions and all branch/ownership checks. Reject submit without create with an explicit compatibility reason rather than silently adding authority.