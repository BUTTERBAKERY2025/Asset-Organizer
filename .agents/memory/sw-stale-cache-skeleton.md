---
name: SW stale-cache infinite skeleton
description: Why some users saw permanent skeleton loaders after deploys, and the SW rules that prevent it
---

Symptom: after a deploy, SOME users (stale caches) get pages stuck forever on the gray Suspense skeleton (e.g. /hr-hub); hard refresh fixes it, redeploy doesn't.

Root causes in client/public/sw.js:
- JS fetch handlers returned an **empty 503 Response** on failure → dynamic `import()` neither resolves nor triggers the chunk-error reload logic in pagePreloader → skeleton forever. Rule: on failure with no cache, return `Response.error()` (a real network error) so `import()` rejects with "Failed to fetch" and the one-shot reload guard in pagePreloader kicks in.
- `networkFirstJs` had **no timeout** → a hanging network request hangs the import indefinitely. Rule: AbortController timeout (10s) then cache fallback / Response.error().
- The cached `/` (index.html) was only written at SW install → could point at deleted chunk hashes. Rule: re-cache `/` on every successful navigation, with the write bound to `event.waitUntil` (clone synchronously in the .then before returning to respondWith, or the body may already be consumed).

**How to apply:** any future SW edit must preserve these three properties; bump cache version names (butter-vN) when changing caching behavior so stale caches are purged on activate.
