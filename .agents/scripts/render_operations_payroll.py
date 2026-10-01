import sys
from pathlib import Path
import fitz

path = Path(sys.argv[1])
document = fitz.open(path)
for index, page in enumerate(document):
    image_path = path.with_name(f"{path.stem}-page-{index + 1}.png")
    page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(image_path)
    body_spans = [
        span
        for block in page.get_text("dict")["blocks"] if block["type"] == 0
        for line in block["lines"]
        for span in line["spans"]
        if span["bbox"][1] > 60 and span["bbox"][3] < page.rect.height - 52
    ]
    print(f"page={index + 1} image={image_path} body_spans={len(body_spans)} colors={sorted(set(span['color'] for span in body_spans))}")
print(f"Rendered {len(document)} synthetic pages with PyMuPDF.")