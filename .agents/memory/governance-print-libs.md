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

## Async print → about:blank popup + document.write (NOT Blob/iframe)
These print docs rely on INLINE `<script>` (board builds ALL its content via an inline paginator;
assembly/minutes use an injected `load`→print listener). Production helmet CSP is `scriptSrc: 'self'`
(NO `'unsafe-inline'`). **Blob: URLs and iframes INHERIT the page CSP → their inline scripts are blocked
→ blank page** (board especially, since its content is script-built). An `about:blank` popup written via
`document.write` does NOT inherit the HTTP-header CSP, so inline scripts run — this is why the original
voting.tsx popup print worked. **Do not switch these to Blob/iframe/srcdoc.**

Three rules when a page must `await` (fetch tokens/signatures) BEFORE printing:
1. Open the window SYNCHRONOUSLY in the click handler or the popup is blocked. Use
   `openPrintWindow()` (in `client/src/lib/print-window.ts`): it `window.open('','_blank')`s AND
   immediately `document.write`s a small loading placeholder to CLAIM the document. Pass the window
   down as a `targetWindow` arg; libs fall back to `openPrintWindow()` when omitted.
2. After data is ready, write final HTML via `renderToPrintWindow(win, html)` =
   `document.open(); document.write(html); document.close();`. The sync placeholder + explicit
   `document.open()` is what makes write-after-`await` render reliably (plain write-after-await = blank).
3. Auto-print lives as an inline `<script>` inside the HTML (board: font-ready→doPrint; assembly/minutes:
   injected `load` listener). Opener-side `win.onload`/`setTimeout(win.print)` are unreliable.
**Why:** the unified signed-resolutions page fetches on click (unlike voting.tsx which has tokens in
state), so a naive sync `document.write` wasn't possible and a first Blob attempt went blank in prod CSP.

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
