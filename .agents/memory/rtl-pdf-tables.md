---
name: Arabic PDF table ordering
description: pdfMake text alignment does not determine visual column order.
---
For Arabic pdfMake documents, right-aligned text alone does not give tables an RTL column order. Reverse the headers, row cells, and width definitions together when starting from an RTL logical field list.

**Why:** A document can have readable Arabic yet put the sequence and identity columns on the opposite side from the HTML print and Excel documents. A successful PDF download or text extraction will not detect this discrepancy.

**How to apply:** Inspect the rendered table, not just extracted Arabic text. Keep source/destination and signature blocks in the same visual order across formats, and never reverse Arabic text strings to simulate RTL.