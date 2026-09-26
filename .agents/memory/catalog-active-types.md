---
name: Historical catalog active flag types
description: Raw SQL must tolerate both boolean and text active flags in existing database instances.
---

Normalize the catalog active flag with an explicit text cast before applying text functions such as `trim` and `lower`.

**Why:** The local database held `products.is_active` as a boolean even though code paths treated it as text. The internal bar reservation failed at runtime with `trim(boolean)` despite a successful build.

**How to apply:** Inspect the physical column type when debugging catalog eligibility, and make read predicates tolerant of both historical representations. Do not alter an existing database column merely to match a TypeScript declaration.