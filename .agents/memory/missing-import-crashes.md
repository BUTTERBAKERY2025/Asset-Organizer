---
name: Missing-import runtime crashes (full-page ErrorBoundary)
description: A PascalCase identifier (often a lucide icon) used but not imported crashes a page deterministically in dev AND prod; redeploying never fixes it.
---

# Missing-import / undefined-identifier crashes

A page that references a PascalCase identifier (commonly a `lucide-react` icon, or a
component) in JSX, in an `icon: X` object field, or as a `component={X}` prop, **without
importing or declaring it**, throws `ReferenceError: X is not defined` at render time.

**Symptoms:** the app's ErrorBoundary shows the generic "حدث خطأ غير متوقع" full-page box
(no sidebar/header, because each page renders `<Layout>` *inside* itself, so Layout never
mounts). It is **deterministic** and happens in **both dev and prod** — it is NOT a
deployment, cache, or chunk-loading problem, so redeploying on Render never fixes it.
Distinguish from the chunk-load case: the ErrorBoundary shows "تم تحديث النظام" for
ChunkLoadError, "حدث خطأ غير متوقع" for a real ReferenceError/render error.

**Why it slips through:** Vite dev transpiles without type-checking and the Vite/esbuild
*build* does NOT catch undefined-identifier references either — it bundles them as free
variables that only blow up at runtime. Only `tsc` (TS2304 "Cannot find name") catches it
statically.

**How to find it on this repo:** `npm run check` (full `tsc --noEmit`) is authoritative but
is too slow / OOM-prone here (often never finishes even with `--max-old-space-size`). Use a
targeted heuristic instead: for each `client/src/**/*.tsx`, collect imported + locally
declared names, then flag any PascalCase identifier used in `<Tag`, `icon: X`, or
`component={X}` that is not available. Ignore false positives: TS generics (`T`, `TData`),
DOM lib globals (`HTMLCanvasElement`, `MediaStream`, …), and destructured/param-bound caps
(`Icon`, `Component` rendered as `<Icon/>`/`<Component/>`).

**To confirm a prod crash is code (not deploy):** fetch the live bundle
(`curl https://<site>/assets/index-*.js`) and grep for the expected strings/registrations —
if they are present and chunks return 200, the deploy is fine and the bug is in the code.
