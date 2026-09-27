---
name: Permissions must never be served from stale client cache
description: Why /api/my-permissions must bypass every client cache layer, or users flip to /my-portal
---

Authorization data (`/api/my-permissions`) must always be fetched network-fresh. A
stale/empty permissions response makes the client believe the user has no modules and
bounces them to `/my-portal` ("account not linked to employee") — the classic "works
for a bit then flips to the portal" prod symptom.

**Why:** there are THREE independent client cache layers that will each happily replay a
stale-empty permissions payload, and `usePermissions` uses `refetchOnMount:false` +
long `staleTime`, so once a stale copy is held it is never refreshed within the session:
1. Service worker (`client/public/sw.js`) — stale-while-revalidate returns cached first.
2. localStorage persistence (`persistentCache.ts` PERSIST_ENDPOINTS) hydrated into React
   Query at startup via `hydrateFromPersistentCache()` in `queryClient.ts`.
3. React Query in-memory staleTime.

**How to apply:** keep `/api/my-permissions` (and any authz-sensitive endpoint) OUT of
every cache allowlist — SW bypass like `/api/auth/*`, not in SAFE_STALE_ENDPOINTS, not in
PERSIST_ENDPOINTS, not in the hydrate list. When you must invalidate already-persisted
stale copies on existing clients, bump the cache version tokens (SW `CACHE_NAME`/
`STATIC_CACHE`/`API_CACHE`, and `persistentCache.ts` `CACHE_VERSION`) so old stores are
purged on next load. Frontend-only change, but PROD needs a manual Render redeploy + one
hard refresh for the new service worker to activate.

Workflow details that determine the next permitted action also need fresh reads, not offline stale-response fallbacks.

**Why:** A kitchen order can appear prepared in a fresh queue while a stale detail still offers preparation. Reloading the page does not guarantee freshness when a service worker answers slow requests from its own cache.

**How to apply:** When list and detail disagree after a transition, compare the authoritative state first and inspect every response cache before advising a reload. Cache regression tests must use authenticated, successful responses large enough to cross the middleware's cache-size threshold; otherwise the tests can pass without exercising caching at all.
