---
name: Recipe book versus operational material access
description: Independent recipe permissions must not silently disable recipe-backed production.
---

Keep recipe-book administration independently authorized, while preserving branch-scoped operational material requirements and frozen batch evidence for authorized production operators.

**Why:** Removing recipe-book access must not force an operator's batch into unlinked production and skip ingredient consumption. Book access and the information needed to execute an authorized batch are different boundaries.

**How to apply:** Never default recipe-backed production to false because recipe-book permission is absent. Protect general recipe listing, editing and printing separately, and keep operational evidence scoped to the authorized kitchen/batch.