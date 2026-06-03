---
name: Lazy page registration
description: Adding a new lazy-loaded page requires two edits in lockstep, or preloading crashes at runtime.
---

# Lazy page registration must stay in sync

When adding a new page wired via `makeLazy("page-key")` in `client/src/App.tsx`,
you MUST also add a matching entry to the `pageImports` map in
`client/src/lib/pagePreloader.ts`:

```ts
"page-key": () => import("@/pages/page-file"),
```

**Why:** `makeLazy(key)` returns `React.lazy(() => preloadAndCache(key))`. When the
route's lazy component renders, `preloadAndCache` looks `key` up in `pageImports`
and rejects with `Unknown page: <key>` if missing — caught by the ErrorBoundary as
"حدث خطأ غير متوقع" (generic unexpected-error box). Note `preloadPage` (hover/aggressive
prefetch) guards with `if (loader)` so it silently skips missing keys — the crash is
purely the render path, not prefetch.

**How to apply:** Never fix these one-at-a-time (a partial fix just moves the crash to
the next unregistered page and looks like "the deploy didn't work"). Run the full diff
and register every missing key at once:

```bash
comm -23 \
  <(rg -o 'makeLazy\("([^"]+)"' -r '$1' client/src/App.tsx | sort -u) \
  <(rg -o '^\s*"([^"]+)":\s*\(\)\s*=>\s*import' -r '$1' client/src/lib/pagePreloader.ts | sort -u)
```

Empty output = all `makeLazy` keys are registered.
