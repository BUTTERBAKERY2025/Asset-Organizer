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

## Print must use a safe inner margin, NOT full-bleed
The board print uses `@page{margin:8mm}` with the `.sheet` (and `.sheet-bg`
letterhead PNG) sized to the printable area (194×280mm), not the full A4 page.
**Why:** a full-bleed model (`@page{margin:0}` + sheet exactly 210×297mm) gets the
right/bottom edge clipped by any printer hardware margin or the dialog's "Default"
margin setting — the symptom is a footer URL cut off and content looking shrunk
("غير منسقه"). **How to apply:** the four constants must stay mutually consistent or
content overflows/clips — `#measure` width = sheet width − 2×side inset, and paginator
`AVAIL = (sheetHeight − contentTop − contentBottom)×MM`. Keep sheet height a hair under
the printable height (avoids the off-by-one extra blank page). Assembly/minutes already
use safe `@page` margins, so only the board template had this bug.

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
