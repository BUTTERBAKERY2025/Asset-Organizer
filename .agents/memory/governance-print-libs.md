---
name: Governance print & unified resolutions
description: How board/assembly/minutes "official document" printing is shared, and how a cross-type page must fetch across permission modules.
---

# Governance signed-document printing

The three governance document types each have their own print path that builds a self-contained
RTL HTML doc with company letterhead, watermark, electronic signatures, and Hijri/Gregorian dates:
- board resolutions → `client/src/lib/board-resolution-print.ts`
- assembly resolutions → `client/src/lib/assembly-resolution-print.ts`
- meeting minutes → `client/src/lib/meeting-minutes-print.ts`

## Print blank in PRODUCTION → CSP blocks inline scripts; fix = CSP-exempt shell page
These print docs rely on INLINE `<script>` — board builds ALL its content via an inline paginator
(`document.createElement` + measure + `.sheet` pages), and it self-prints; assembly/minutes have an
injected `load`→print listener. **helmet CSP is PRODUCTION-ONLY** (`if NODE_ENV==="production"` in
`server/index.ts`) with `scriptSrc: 'self'` (no `'unsafe-inline'`). So the blank page NEVER reproduces
in the Replit dev preview (helmet off) — only on Render/thebutterbakery.com. Do not trust "works in dev".
**about:blank, Blob:, and iframe/srcdoc ALL inherit the opener's CSP in modern Chrome → their inline
scripts are blocked → blank** (board hits this hardest since its content is script-built). Confirmed
dead ends: blob navigation (blank) and about:blank + document.write (blank).

**Fix (matches the codebase's own pattern):** the popup navigates to a real same-origin page that the
server EXEMPTS from helmet — `client/public/print-document.html`, added to the exempt list in
`server/index.ts` alongside `vote-resolution.html` etc. A document loaded from a CSP-exempt HTTP
response carries NO CSP, so inline scripts written into it run. Flow in `client/src/lib/print-window.ts`:
1. `openPrintWindow()` = `window.open('/print-document.html','_blank')` — call SYNCHRONOUSLY in the
   click handler (popup-blocker). The shell shows an Arabic "جارٍ التحضير" message and defines
   `window.__renderPrint(html)` + `window.__printReady=true`.
2. `renderToPrintWindow(win, html)` POLLS (~25ms, up to 5s) until `win.__printReady`, then calls
   `win.__renderPrint(html)` which does `document.open(); write(html); close()` inside the exempt doc.
3. Libs use `const w = targetWindow ?? openPrintWindow()`; signed-resolutions passes `openPrintWindow()`
   as `targetWindow`. Auto-print stays inline in the generated HTML (now allowed).
**Why polling not onload:** opener can't reliably catch the shell's load; polling for the shell-defined
`__printReady` flag is race-free across the navigation.

**Rule:** keep each print routine in its shared lib as the single source of truth. The owning page
(voting.tsx, assembly-minutes.tsx) calls the lib via a thin wrapper. The unified
`signed-resolutions.tsx` page reuses the same libs so a fix to a document layout lands everywhere.
**Why:** these print functions were duplicated/inline and drifted; lifting them verbatim into libs
avoids two copies of ~400-line HTML generators.

**How to apply:** minutes printing needs the parent meeting record (for date/type/location), so the
caller passes the `GovernanceMeeting` in; the lib falls back to `new Date()` if meeting is undefined.

## Cross-module permission gotcha
A page that aggregates multiple governance types fetches endpoints guarded by DIFFERENT permission
modules (e.g. `/api/governance/resolutions` = governance_resolutions vs `/api/governance/minutes`
and `/api/governance/meetings` = governance_meetings). A user may hold one but not the other.
**Rule:** for the secondary-module fetches, use a tolerant queryFn that returns `[]` on 401/403
(and only throws on other non-ok) so the page degrades gracefully instead of erroring out.
