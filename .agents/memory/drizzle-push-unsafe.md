---
name: drizzle-kit push is unsafe in this repo
description: db:push triggers interactive DESTRUCTIVE prompts on unrelated table drift; for additive nullable columns apply ALTER TABLE ADD COLUMN IF NOT EXISTS directly.
---

Running `npm run db:push` (drizzle-kit push) on this repo stalls/fails: it
reconciles the WHOLE schema, detects pre-existing drift unrelated to your change
(e.g. a unique constraint on `construction_categories`), and asks an interactive
"do you want to truncate <table>?" prompt. That prompt fails in the non-TTY agent
shell, and confirming it would be destructive.

**Rule:** For simple additive schema changes (new nullable columns), do NOT run a
blanket push. Apply the change directly with idempotent SQL against the dev DB:
`ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>;` — then give the user the
same SQL for the prod Supabase manual step (user requires manual SQL before deploy).

**Why:** push wants to fix everything it considers drift, not just your diff, and
some of that reconciliation is destructive / blocked on interactive input.
