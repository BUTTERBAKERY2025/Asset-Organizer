---
name: Supabase authority-table defaults
description: New authorization metadata can inherit browser grants despite being server-only.
---

New server-only permission metadata must explicitly enable RLS and revoke public, anon and authenticated table grants.

**Why:** The source-mode migration inherited Supabase browser-role privileges, unlike neighboring authorization tables. Empty metadata is still authority-sensitive because a browser write could change permission interpretation.

**How to apply:** Check actual post-migration privileges, not just migration intent. Include the source-mode access hardening migration in fresh environments. Do not equate a healthy public endpoint with verification of authenticated permission behavior.