---
name: security scan notes
description: Durable facts about this repo's recurring security-scan findings and which are false positives vs. unfixable-in-env
---

# Security scan recurring findings

## xlsx (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS) — FIXED 2026-07-29
- The repo PARSES untrusted uploads (XLSX.read + sheet_to_json) both client-side and server-side (server/routes.ts buffer parse), so these CVEs were relevant, not theoretical.
- **No fix on the npm registry** — patched build (>=0.20.x) lives only on `https://cdn.sheetjs.com/...tgz`.
- As of 2026-07-29 the CDN tarball install WORKS inside Replit (earlier firewall block no longer applies). package.json now pins `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; Render fetches the CDN fine at build.
- Quirk: npm install may fail once with ENOTEMPTY rename on node_modules — `rm -rf node_modules/<pkg> node_modules/.<pkg>-*` and retry.
- xlsx 0.20.x package.json has strict `exports` (no `./package.json` subpath) — check versions via fs read, not require.

## False positives to not waste time on
- HoundDog flags `server/scheduler.ts` `[scheduler] starting (tick=..., twilio=configured)` as CRITICAL AUTH-TOKEN+PHONE-NUMBER. It logs only the string "configured"/"disabled" — no token, no phone. Confirmed false positive.
- SAST flags `server/media-team-routes.ts` PATCH handler as remote-property-injection, but the key is iterated from a STATIC allowlist array, so it's safe.

## Committed bcrypt hashes in seed SQL (info disclosure)
- `supabase_complete_seed.sql` and `supabase_data_seed.sql` are GIT-TRACKED and contain real users' bcrypt password hashes (incl. admin). SAST flags them HIGH.
- bcrypt is not reversible, but the seed defines the initial admin login, so the safe mitigation is to ROTATE the production admin password after first seed, not to rely on the committed hash being secret.
- **How to apply:** don't delete unilaterally (needs destructive git rm + may break seeding). Recommend to user: rotate admin pwd in prod + gitignore future seeds.

## uuid high (CVE-2026-41907)
- uuid is only a TRANSITIVE dep (not imported in our code). Forcing v11 via override is breaking (ESM-only major). Low practical impact; document rather than force.

## drizzle-orm (CVE-2026-39356 escapeName identifier injection)
- Only exploitable if attacker-controlled input reaches sql.identifier()/.as(); this repo doesn't. Still, upgrading 0.39.x -> 0.45.2 is non-major and app boots clean.

## Lockfile firewall URLs break Render deploys (2026-07-14)
npm installs inside Replit rewrite package-lock.json "resolved" fields to
http://package-firewall.replit.local/npm/... which is unreachable on Render
(ENOTFOUND at build). After ANY package install/upgrade here, before the user
deploys: `grep -c package-firewall package-lock.json` and rewrite to
https://registry.npmjs.org (integrity hashes stay valid). Local installs keep
working — Replit's npm proxy config redirects registry URLs anyway.
