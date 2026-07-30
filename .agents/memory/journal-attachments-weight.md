---
name: Journal attachments DB weight
description: journal_attachments stores base64 in file_data (~15GB, most of the 17GB prod DB); list endpoints must never select it
---

`journal_attachments.file_data` holds base64 blobs (avg ~3.7MB/row); the table is ~15GB of a 17GB prod DB and its per-journal SELECT averaged 1.9s.

**Why:** legacy upload flow stored files in the DB; a Supabase Storage migration route exists (`POST /api/admin/migrate-journal-attachments-to-supabase`, chunked, admin-only) but it does NOT null `file_data` after migrating — migrated rows keep the blob.

**How to apply:**
- Never select `file_data` in list queries — `getJournalAttachments` selects a `hasFileData` boolean and points legacy rows to the lazy stream `GET /api/journal-attachments/:id/legacy-data`.
- Client renders via `downloadUrl` first, so server-side URL synthesis is the only thing needed.
- To reclaim the 15GB: finish migrating the remaining legacy rows, verify Supabase objects exist, then NULL `file_data` for migrated rows + VACUUM — destructive, needs explicit user approval.
- Aggregates like `sum(length(file_data))` time out on prod; use counts/filters only.
