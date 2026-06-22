---
name: Governance print pagination
description: Why governance print/PDF docs must use the spacer-table technique instead of manual page splitting.
---

# Governance print/PDF pagination

Governance print documents (board resolutions in `resolutions.tsx`, general-assembly
resolutions in `voting.tsx`) open a new window and `document.write` an A4 print doc with a
fixed full-page letterhead image behind the content.

**Rule:** lay the document out as a single flowing "spacer table" — an outer
`<table>` whose `<thead>` reserves the top safe-zone (e.g. 30mm) and `<tfoot>` reserves the
bottom safe-zone (e.g. 20mm), with all content (header, body text, nested data tables,
signatures) inside one `<tbody><tr><td>` content cell (side padding ~16mm). The fixed
letterhead sits at `z-index:0`, the spacer table at `z-index:1`.

**Why:** browsers repeat a table's thead/tfoot on every printed page, so the reserved
safe-zones keep flowing content from colliding with the fixed letterhead's header/footer
bands on page 2+. The old approach — manual page splitting (`rowsPerPage`, fixed
`.print-page` divs at `min-height:297mm` with per-div padding) — overflowed the synthetic
page boundary; overflow content collided with / was masked by the fixed letterhead, which
in saved PDFs (and on zoom) showed up as **disappearing content**: data-table rows
rendering as empty alternating gray bands with no text/badges/signatures.

**How to apply:** never reintroduce manual row-per-page splitting for these docs. Let
content flow; add `break-inside:avoid` to data-table rows + boxed sections and
`break-after:avoid` to section headings. A nested data table inside the content cell
flows fine; its own `<tfoot>` totals row renders once at the natural end (acceptable —
verify placement only for very long voter lists). Keep `voting.tsx` and `resolutions.tsx`
on the same spacer-table pattern to avoid regressions.
