---
name: Authorization rollout roadmap
description: User-supplied six-stage sequence and rollout boundaries, distinct from individual security fixes.
---

The user supplied this sequence: approve the job/action/scope/assigner matrix; fix core authorization; build approved versioned job templates; simplify the operations-manager assignment UI; separate admin-managed additions; compare existing accounts and run an approved gradual pilot and migration.

**Why:** The user asked to assess actual progress against these six stages, rather than treat individual fixes or test infrastructure as completion of the template rollout.

**How to apply:** Use docs/operational-job-template-matrix.md and docs/governance/phase1-inventory-and-policy.md as starting evidence, not proof of matrix approval. Report implementation separately from approved policy and verified deployment. Do not change existing employee accounts or permissions in bulk. Library dependency remediation remains a separate parallel track, not a replacement for the six stages.

Start template work as versioned drafts, separate from legacy templates that can already be applied to accounts. Proposed scope and assignment authority are review metadata, not effective authorization.

**Why:** The user authorized beginning draft preparation while the job matrix was still unapproved, with no activation or changes to existing employee permissions.

**How to apply:** Never interpret saving a draft/version or generating proposals as policy approval. Add explicit version approval before operations-manager assignment; bind future assignments to that approved version and server-side scope checks.

Version approval certifies reviewed template content, not employee authority. Approving an empty template does not revoke intrinsic role grants or self-service access.

**Why:** The authorized next step was explicit admin review without applying templates to employees; these are distinct transitions.

**How to apply:** Preserve prior approval history when adding an unapproved version. Phase-four assignment must recheck employee eligibility, branch scope and the allowed permission ceiling even when a version is approved.

Operations template-only granting must cover legacy write paths, not just the new selector. Preserve true safety reductions and existing admin authority; a reduction must not leave a current binding falsely describing an unchanged template base.

**Why:** The old delegated raw-permission endpoints could still grant without approval after the new selector was added. Explicit inheritance also makes stored dormant direct rows an unsafe reference for deciding whether a write is only a reduction.

**How to apply:** Judge reductions against effective authority, keep assignment provenance and audit atomic, and do not relax independent-assignment/override protections before phase five separates admin additions.

Independent extras may relax operations protection only when their provenance is intact and their authority remains within the delegated safe ceiling. Unknown legacy overrides, privileged extras and drifted records stay protected.

**Why:** Separating the base from additions is not permission to let operations manage accounts carrying admin-level authority, or to relabel an old deny as an approved new addition.

**How to apply:** Preserve extras and denies on base changes; advertise scoped additions only where actual resource routes enforce that scope. Record start dates in the runtime authority source, not merely auxiliary provenance.