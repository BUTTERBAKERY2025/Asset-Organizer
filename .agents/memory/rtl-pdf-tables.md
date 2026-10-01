---
name: Arabic PDF table ordering
description: pdfMake text alignment does not determine visual column order.
---
For Arabic pdfMake documents, right-aligned text alone does not give tables an RTL column order. Reverse the headers, row cells, and width definitions together when starting from an RTL logical field list.

**Why:** A document can have readable Arabic yet put the sequence and identity columns on the opposite side from the HTML print and Excel documents. A successful PDF download or text extraction will not detect this discrepancy.

**How to apply:** Inspect the rendered table, not just extracted Arabic text. Keep source/destination and signature blocks in the same visual order across formats, and never reverse Arabic text strings to simulate RTL.

Bound wide payroll detail tables to the printable page width and make long serialized date lists wrappable without changing the source values.

**Why:** pdfMake star-column minimum widths can expand around an unbroken JSON date array and push the actual text outside the page, leaving apparent blank ruled grids. Text extraction alone can still pass.

**How to apply:** Include full-month date arrays and long identifiers in PDF regression fixtures; inspect raster output and on-page geometry, not merely the existence of text in the PDF.