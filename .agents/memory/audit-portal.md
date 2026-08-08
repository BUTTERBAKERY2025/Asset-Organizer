---
name: Audit portal (بوابة المراجعة المالية)
description: External auditor role lockdown, requirement state machine, file sniffing rules
---
- Role `external_auditor` gets a standalone shell at /audit-portal; the real boundary is server-side `auditorApiLockdown` (registered right after setupAuth) which 403s every /api path except /api/audit/*, /api/auth/*, /api/my-permissions. Any new public-ish API is auto-blocked for auditors — good; but if the auditor portal ever needs a new endpoint, put it under /api/audit/.
- Roles: team = admin|financial_manager (active); auditor accounts managed only by admin via /api/audit/auditor-accounts (storage.createUser/updateUser hash passwords internally).
- Requirement state machine enforced server-side: auditor may approve/reject only from `uploaded`; team may never change an `approved` item; all mutations (status, comments, file/requirement delete, upload) blocked when period status = closed. UI buttons mirror but do not replace these checks.
- Uploads: extension whitelist + magic-byte sniff must agree (pdf/zip-family/xls-doc/png/jpg; csv = no NUL bytes, no binary signature). Storage key is ASCII (`audit_<period>_<ts><ext>`), Arabic filename kept in DB; downloads set nosniff.
- Tables audit_periods/requirements/files/comments/activity_log created idempotently in server/db.ts startup migration AND applied directly to Supabase prod.
**Why:** review found auditor session could otherwise call global search/dashboards; deny-by-default middleware chosen over per-route guards.
- `downloadFromSupabase` returns a WRAPPER `{ data: Blob, mimeType }` — must call `wrapper.data.arrayBuffer()`, never `wrapper.arrayBuffer()` (silent 500 → "Failed to load PDF"). Preview endpoint `/api/audit/files/:id/preview` (PDF/images inline only) must also stay in the sw.js `/preview` bypass list or the SW 2s timeout kills large files.
- `users` table has NO `name` column (only firstName/lastName/username) — selecting users.name via Drizzle throws at runtime (see drizzle-undefined-select-field.md); audit-portal getCtx builds name from firstName+lastName.
