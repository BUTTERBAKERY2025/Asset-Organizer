---
name: Complaint attachment privacy
description: Why complaint attachments must not reuse the generic Supabase upload fallback.
---

Use the existing private Object Storage for complaint attachments, never an unverified Supabase documents bucket.

**Why:** The configured Supabase client could not prove the documents bucket private; its generic startup bucket setup fails with RLS. Private Object Storage readiness succeeded. Complaint files can contain confidential staff/customer information and must remain behind complaint branch authorization, not merely an authenticated generic download URL.

**How to apply:** Keep complaint attachment paths server-generated, do not expose raw paths in responses, and never introduce a public-storage fallback when the private provider is unavailable.