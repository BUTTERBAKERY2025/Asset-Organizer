---
name: Render deploy vs Replit lockfile URLs
description: npm installs on Replit write internal package-firewall URLs into package-lock.json, breaking Render builds
---

Rule: after ANY `npm install` in this workspace, check package-lock.json for `http://package-firewall.replit.local/npm/...` resolved URLs and rewrite them before pushing:

```
sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
```

**Why:** Production deploys run on Render (auto-deploy from GitHub). Render's npm cannot reach Replit's internal package firewall, so the build "Exited with status 1". Happened 2026-07-28 (vitest install) and at least once before ("Fix deployment issues by correcting internal links in package lock file").

**How to apply:** integrity hashes stay valid (same tarballs); URL path format maps 1:1 (`/npm/<pkg>/-/<file>.tgz` → registry.npmjs.org). Verify with `grep -c package-firewall package-lock.json` = 0 and JSON still parses.

Update 2026-08-04: a naive sed of the firewall URL can leave malformed `http://registry.npmjs.org/npm/<pkg>/...` entries (extra `/npm/` path + http) — Render `npm ci` then fails with build status 1. After any lockfile cleanup also run: `grep -c 'registry.npmjs.org/npm/\|http://registry' package-lock.json` and expect 0; fix with `sed -i 's|https\?://registry.npmjs.org/npm/|https://registry.npmjs.org/|g; s|http://registry.npmjs.org/|https://registry.npmjs.org/|g'`.
