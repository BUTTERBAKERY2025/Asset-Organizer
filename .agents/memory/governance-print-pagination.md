---
name: Governance print pagination
description: How the board-resolution print in voting.tsx paginates (bounded-sheet JS paginator) and why the older approaches failed.
---

# Governance print/PDF pagination

Governance print documents (board/assembly resolutions) open a new window and
`document.write` an A4 print doc with the official letterhead behind the content.

## Current approach (voting.tsx — printResolutionWithSignatures)
**Bounded-sheet + measurement-based JS paginator.** Content is packed into fixed
`.sheet` divs (210×297mm, `overflow:hidden`, `page-break-after`). The letterhead is
`position:absolute` INSIDE each sheet (NOT `position:fixed`). A script renders blocks
hidden in `#measure`, measures real heights, then distributes them across sheets and
stamps `صفحة X من Y` in the clear band above the letterhead's dark footer bar.

**Why this approach:** it is the only way to get real per-page numbering — Chrome
ignores `@page` CSS counters. It also fixes the classic Chrome blank-first-page bug
that a `position:fixed` full-page letterhead with `@page{margin:0}` triggers.

**Non-obvious rules that keep it correct:**
- Resolution body text must be SPLITTABLE: pass it as structured `{cls,title,text}`
  (not pre-built HTML) so the paginator can split a too-tall block by lines (then by
  words) across pages. With `overflow:hidden`, an unsplit oversized block is silently
  clipped — losing legal content. Only residual clip = a single word taller than a
  whole page (impossible in practice).
- Signature image heights MUST be fixed in CSS (`height`, not `max-height`) so measured
  row/sign-block heights are deterministic and don't depend on async data-URI decoding;
  this lets measurement run after `fonts.ready` alone (no image-load wait needed).
- A section head must keep-with-next: measure the FIRST fragment of whatever follows
  (next html block, or first text line, or table thead+first row) before placing the
  head, else it orphans at page bottom.
- Empty voter list must still render thead + one "لا يوجد مصوتون" row (don't omit the
  table — it's a formal document).
- Re-emit the table `<thead>` at the top of every row chunk.
- Keep a double-run guard (ready/fallback race) + a hard timeout fallback.
- The executable inline `<script>` MUST be data-free: serialize all runtime data
  into a `<script type="application/json" id="print-data">` island and read it via
  `JSON.parse(getElementById('print-data').textContent)`.
  **Why:** interpolating data straight into JS (`var flow = {...}`) can produce a
  parse error on unusual real input → the WHOLE script dies → the try/catch
  fallback + watchdog never run → about:blank, totally blank popup (the symptom
  the user kept hitting). JSON in a non-executed script tag is inert text and can
  never break JS syntax. Still escape `</`→`<\/` to avoid early tag close.
- Self-healing is mandatory: wrap `build()` in try/catch → guaranteed flowing
  fallback render; `hasRendered` flips ONLY after successful DOM insertion (so a
  late insertion failure still leaves the fallback available); add a ~3s watchdog.

## Board letterhead is a full-bleed raster; content insets MUST match its artwork
The board print background is the official letterhead PNG
(`attached_assets/official-letterhead.png`, full A4, base64-inlined via `?inline`),
drawn as `.sheet-bg` filling a full-bleed sheet (`@page{margin:0}`, `.sheet`
210×297mm). The current letterhead has its OWN safe margins (logo ~19mm from top,
footer line ~10mm from bottom, header/footer rules inset ~20mm from the sides), so
full-bleed does NOT clip. `.sheet-content` insets are tuned to that artwork:
top 56mm (just below the header gold rule at ~54mm), bottom 30mm (above the footer
green rule at ~274mm), left/right 20mm (aligned to the rules); `#measure` width 170mm
(=210−20−20); paginator `AVAIL=(297−56−30)×MM`.
**Why this matters:** an EARLIER letterhead had its footer URL at the extreme bleed
edge, so full-bleed + any printer/dialog margin clipped it (symptom: cut-off footer,
content looking shrunk — "غير منسقه"). The fix was NOT a page margin; it was swapping
to a letterhead whose critical content is safely inset.
**How to apply when the letterhead image changes:** measure the new artwork's rule
positions (e.g. `pdftoppm`+PIL row-darkness scan) and re-tune the four constants in
lockstep — content top below the top rule, bottom above the footer rule, `#measure`
width = sheet − 2×side inset, `AVAIL=(297−top−bottom)×MM` — or content overlaps the
letterhead or overflows (`overflow:hidden` silently clips). Keep `.sheet-bg`
`position:absolute` (never `fixed`) to avoid the Chrome blank-first-page bug.
Assembly/minutes use CSS text headers (green `#1a5f3c` / gold `#b8860b` rules), NOT
this raster — they're unaffected by letterhead-image swaps.

## Auto-print after shell document.write — don't rely on the load event
Assembly/minutes templates auto-print via an inline trigger. When the print SHELL
`document.write`s the doc, `load` has usually already fired, so a bare
`window.addEventListener('load', print)` never runs → no print dialog. Use a
readyState-aware self-invoking trigger: print now if `document.readyState==='complete'`,
else attach the load listener. (Board uses a setTimeout, so it was unaffected.)

## Older approaches that FAILED (do not reintroduce)
- `position:fixed` full-page letterhead + `@page{margin:0}` → Chrome blank first page,
  and no way to number pages.
- Spacer-table (outer `<table>` thead/tfoot reserving safe-zones, content in one
  `<tbody><tr><td>`) → flows fine and avoids letterhead collisions, BUT cannot produce
  per-page "صفحة X من Y" numbers, which the user requires.
- Manual `.print-page` divs at `min-height:297mm` → overflow collided with the fixed
  letterhead → disappearing rows (empty gray bands) in saved PDFs.

Note: `resolutions.tsx` may still use a different (older) technique; only `voting.tsx`
was migrated to the bounded-sheet paginator. Verify before assuming parity.

Empty-string blocks break the paginator: measureHtml("") -> firstElementChild null -> appendChild throws -> silent fallback render WITHOUT letterhead/page numbers. Guard every optional block (if (html) add(...)) and make measureHtml return 0 for null.
