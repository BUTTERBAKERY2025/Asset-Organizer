#!/bin/bash
set -e

# Post-merge setup: install dependencies. The database schema is applied by the
# app's startup migrations (server/db.ts) when the workflow restarts after merge.
# Note: do NOT run `drizzle-kit push` here — it prompts an interactive,
# destructive truncate on unrelated table drift and would fail/hang (stdin is closed).

rm -rf node_modules/.xlsx-* 2>/dev/null || true
npm install --no-audit --no-fund
