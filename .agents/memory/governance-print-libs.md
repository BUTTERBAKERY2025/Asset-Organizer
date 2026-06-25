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

## Print blank in PRODUCTION → TWO production-only blockers (CSP + COOP); fix = exempt shell + localStorage handoff
These print docs rely on INLINE `<script>` — board builds ALL its content via an inline paginator
(`document.createElement` + measure + `.sheet` pages), and it self-prints; assembly/minutes have an
injected `load`→print listener. **helmet is PRODUCTION-ONLY** (`if NODE_ENV==="production"` in
`server/index.ts`), so neither blocker reproduces in the Replit dev preview — only on
Render/thebutterbakery.com. Do not trust "works in dev". Diagnose with `curl -sI` against prod.

Blocker 1 — **CSP `scriptSrc: 'self'`** (no `'unsafe-inline'`): about:blank, Blob:, and iframe/srcdoc
ALL inherit the opener's CSP → inline scripts blocked → blank (board hits this hardest).
Blocker 2 — **COOP `same-origin`** (helmet default, not disabled): when the opener (COOP same-origin)
opens a popup whose document has NO COOP, the browsing-context group is SEVERED → opener's
`window.open()` return becomes a disowned proxy → cross-window `win.__printReady`/`win.__renderPrint`
are UNREACHABLE → popup sticks on the loading message forever. (about:blank inherits the opener's COOP
so it stays connected — which is why the old voting.tsx about:blank+write worked but a real exempt page
does not.) Confirmed dead ends: blob nav (blank), about:blank+write (CSP blank), and a CSP-exempt shell
driven by cross-window `__renderPrint` (COOP-severed → stuck on loading).

**Fix (current):** CSP-exempt shell page + **localStorage handoff** (no cross-window scripting, so COOP
is irrelevant; localStorage is shared per-origin across all windows regardless of COOP).
- Shell `client/public/print-document.html` is in the helmet exempt list in `server/index.ts` (alongside
  `vote-resolution.html`) → served with NO CSP, so inline scripts written into it run.
- `client/src/lib/print-window.ts` exports `PrintTarget {key, win}`. `openPrintWindow()` generates a
  unique key, opens `/print-document.html?v=2#<key>` SYNCHRONOUSLY in the click handler (popup-blocker),
  returns the handle. `renderToPrintWindow(target, html)` does `localStorage.setItem(target.key, html)`
  (fallback: direct `document.write` if localStorage throws, for dev).
- The shell reads `key` from `location.hash`, POLLS its own `localStorage` (~25ms, up to ~12s) until the
  key is present, `removeItem`s it, then `document.open/write/close(html)` to self-render + auto-print.
- Libs (`board/assembly/minutes`) take `targetWindow?: PrintTarget | null`; null-check `target.win`.
  `signed-resolutions.tsx` calls `openPrintWindow()` and passes the handle; standalone callers
  (voting/general-assembly/assembly-minutes) pass nothing so libs self-open.
**Notes:** `?v=2` query busts the browser cache of the old shell (shell served `cache-control: max-age=3600`);
bump it whenever the shell changes. Letterhead PNG ~157KB → base64 well under the ~5MB localStorage quota.

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
