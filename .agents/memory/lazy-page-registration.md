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

**Why:** The route still renders without the registry entry (lazy import resolves
directly), so it looks fine in normal navigation. But hover-prefetch and aggressive
preload call `preloadAndCache(key)`, which looks the key up in `pageImports` and
throws `Unknown page: <key>` when it is missing — surfacing as a runtime error
overlay to the user.

**How to apply:** Any time you add/rename a `makeLazy(...)` call, grep the new key
in `pagePreloader.ts` and add/update the import entry in the same change.
