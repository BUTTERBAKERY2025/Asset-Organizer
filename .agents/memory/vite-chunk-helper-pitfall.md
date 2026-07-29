---
name: vite manualChunks helper pitfall
description: Why the entry chunk can force-load huge lazy vendor chunks (vendor-print/xlsx) and how chunking must route helper modules
---

# manualChunks: shared helpers drag lazy vendor chunks into first paint

Rule: in vite.config.ts manualChunks, always route bundler helper modules —
`vite/preload-helper`, `vite/modulepreload-polyfill`, `commonjsHelpers`,
`@babel/runtime`, `tslib`, `regenerator-runtime` — into the eager
`vendor-react` chunk, BEFORE the `node_modules` guard.

**Why:** these tiny shared modules otherwise land inside whichever big lazy
vendor chunk references them first (here: vendor-print 3.4MB, vendor-xlsx
1.4MB), so the entry statically imports those chunks and index.html
modulepreloads ~4.8MB before first paint — the root cause of slow app open
(fixed 2026-07-29). Do NOT blanket-route all `\0` virtual modules to
vendor-react: commonjs-proxy virtuals then make vendor-react import
vendor-xlsx/print, reintroducing the eager load.

**How to verify after any chunking/dep change:** build, then
`grep modulepreload dist/public/index.html` — vendor-print / vendor-xlsx must
NOT appear; also check no `index-*.js` chunk has `from"./vendor-print` /
`vendor-xlsx`. vendor-charts eager is accepted (dashboards need it at login).
