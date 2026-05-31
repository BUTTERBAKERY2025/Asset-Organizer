---
name: routes.ts line endings & db:push blocker
description: Two environment quirks that break the obvious approach when editing server/routes.ts or pushing schema
---

## server/routes.ts has mixed line endings
The `read` tool's line offsets do NOT match `rg`/`awk` line numbers for `server/routes.ts`
(read tool sees ~22.8k lines, rg/awk see ~28k+). 
**How to apply:** To view/locate code by line number in routes.ts, use `awk 'NR>=A && NR<=B'`
or `sed -n 'A,Bp'`, NOT the read tool with offset/limit. Use `edit` with unique string context
(the edit tool matches on content, so it still works fine).

## `npm run db:push` is blocked by an unrelated interactive prompt
db:push aborts with a TTY error because of a pre-existing pending change
(`construction_categories_slug_unique` wants to truncate a populated table). It is non-interactive
so it can never confirm.
**How to apply:** For targeted dev schema changes, apply them directly via
`psql "$DATABASE_URL" -c "..."` instead of relying on db:push. Verify no duplicate data exists
before adding UNIQUE indexes.
