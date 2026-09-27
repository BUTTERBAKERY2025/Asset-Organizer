---
name: Complaint attachment privacy
description: Why complaint attachments must not reuse the generic Supabase upload fallback.
---

Use a dedicated private provider for complaint attachments, never the generic Supabase documents bucket. Replit's object-storage sidecar is unavailable on external Render deployments; those require server-only Supabase credentials and a separately protected evidence bucket.

**Why:** A production audit found that the documents bucket's `public=false` coexisted with public-role SELECT, INSERT and DELETE policies. Bucket privacy metadata alone therefore does not prove confidentiality. Complaint files can contain confidential staff/customer information and must remain behind complaint branch authorization.

**How to apply:** Audit storage policies as well as bucket metadata. Coordinate removal of anonymous policies with server-credential setup and deployment, not before. Keep paths server-generated and provider-specific; never reinterpret legacy Replit paths as Supabase keys or introduce a public fallback. Existing Replit objects need an explicit authenticated migration to become available on Render.