---
name: Governance resolution print routing
description: Which print generator renders which resolution — board vs assembly tables are easy to confuse.
---

- `board_resolutions` table can hold **assembly-typed** resolutions (`resolution_type='extraordinary_assembly'` / `general_assembly` / `ordinary_assembly`). These are voted via voting **tokens** and printed by `client/src/lib/board-resolution-print.ts` (`buildBoardResolutionHtml` → `printBoardResolutionWithSignatures`). Its title logic alone produces «محضر قرار الجمعية العمومية ...».
- `signed-resolutions.tsx` routes `row.source==='board'` (rows from `board_resolutions`) to the board printer, and only `row.source==='assembly'` (the separate `assembly_resolutions` table) to `assembly-resolution-print.ts`. So a "جمعية عمومية" PDF is often the **board** printer, not the assembly one.
- **Why:** an extraordinary-assembly resolution (e.g. RES-2026-0017) lives in `board_resolutions`, so editing `assembly-resolution-print.ts` for it has no effect. Tell-tale signs the PDF came from the board printer: «عدد المصوتين … مساهم» + «الأسهم المصوتة» info cells, «موقّع إلكترونياً» under each signature, and the per-token «سجل التصويت» columns (# / اسم المساهم / عدد الأسهم / التصويت / تاريخ ووقت التصويت / التوقيع).
- **How to apply:** before changing a governance resolution PDF, confirm which table the resolution number is in and which `source` the printing page assigns; match the generator file accordingly.
- The board printer paginates via a data-free JSON-island script with a bounded-sheet paginator + emergency `fallback()`; `flow` items are `html` | `text` | `table`, and the voting table is emitted by `emitTable()` (re-emits `<thead>` per page chunk). Keep the executable script free of interpolated data or you risk a blank print page.
- The chairman (رئيس مجلس الإدارة) is rendered in TWO places: the «توقيعات أعضاء مجلس الإدارة» sig-grid (from `signatures`) AND the bottom official sign-row (chairmanName + chairmanSig + company stamp). He must be filtered out of the sig-grid (same `normalizeAr` chairman heuristic) so his name/signature isn't duplicated on the last page. **Why:** both sources independently include him.
