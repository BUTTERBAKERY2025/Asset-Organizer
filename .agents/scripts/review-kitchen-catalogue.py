from pathlib import Path
import fitz

pdf = next(Path("attached_assets").glob("*1790343754311.pdf"))
out = Path("/tmp/kitchen-catalogue-review")
out.mkdir(exist_ok=True)
doc = fitz.open(pdf)
print("pages:", len(doc))
for i, page in enumerate(doc):
    page.get_pixmap(matrix=fitz.Matrix(2, 2)).save(str(out / f"page-{i+1}.png"))
    (out / f"page-{i+1}.txt").write_text(page.get_text(), encoding="utf-8")
    print(i+1, len(page.get_text()), str(out / f"page-{i+1}.png"))