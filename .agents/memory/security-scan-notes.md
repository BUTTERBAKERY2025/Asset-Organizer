---
name: security scan notes
description: Durable facts about this repo's recurring security-scan findings and which are false positives vs. unfixable-in-env
---

# Security scan recurring findings

## xlsx (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS)
- The repo PARSES untrusted uploads (XLSX.read + sheet_to_json) both client-side and server-side (server/routes.ts buffer parse), so these CVEs are relevant, not theoretical.
- **No fix on the npm registry** — SheetJS stopped publishing there; latest npm is 0.18.5. The patched build (>=0.20.x) lives only on `https://cdn.sheetjs.com/...tgz`.
- **The Replit package firewall blocks URL/tarball installs** (npm gets a wrapped arg and fails). So xlsx cannot be auto-upgraded in this environment.
- **How to apply:** treat as a MANUAL production step — on Render, set package.json `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` and deploy. Do NOT put the URL in package.json inside Replit; the env's npm reconcile will fail on it.

## False positives to not waste time on
- HoundDog flags `server/scheduler.ts` `[scheduler] starting (tick=..., twilio=configured)` as CRITICAL AUTH-TOKEN+PHONE-NUMBER. It logs only the string "configured"/"disabled" — no token, no phone. Confirmed false positive.
- SAST flags `server/media-team-routes.ts` PATCH handler as remote-property-injection, but the key is iterated from a STATIC allowlist array, so it's safe.

## uuid high (CVE-2026-41907)
- uuid is only a TRANSITIVE dep (not imported in our code). Forcing v11 via override is breaking (ESM-only major). Low practical impact; document rather than force.

## drizzle-orm (CVE-2026-39356 escapeName identifier injection)
- Only exploitable if attacker-controlled input reaches sql.identifier()/.as(); this repo doesn't. Still, upgrading 0.39.x -> 0.45.2 is non-major and app boots clean.
