---
name: Central and branch marketing campaigns
description: User-defined mixed campaign ownership and safe legacy classification.
---

«هناك حملات مركزيه وهناك حملات مرتبطه بفرع معين».

**Why:** The user explicitly clarified that both categories must coexist, rather than choosing one model for all marketing.

**How to apply:** Offer central or a specific branch for each campaign. Do not assign existing campaigns to branches or call them central by inference; keep their unclassified state visible until chosen explicitly.

Central campaign authority is independent of replacing a single branch's template; branch authority must never become central authority.

**Why:** Restricting branch A must not revoke independent central authority or change authority in B. A known central resource is not an unknown branch resource.

**How to apply:** Use global grants and global denies for central campaigns; use persisted branch ownership for branch campaigns and their children. Keep aggregates consistent with authorized source rows.