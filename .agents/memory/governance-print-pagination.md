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
