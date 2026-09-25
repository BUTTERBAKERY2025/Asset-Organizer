"""Reproducible, read-only transcription of the four-page finished-goods PDF."""
import glob
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

SOURCE = Path(glob.glob("attached_assets/*1790343754311.pdf")[0])
OUTPUT = Path("server/catalogue-source/kitchen-finished-products.json")
RENDER = Path("/tmp/kitchen-catalogue-review")
GROUPS = [
    ("bakery", "مخبوزات", 40),
    ("pastry", "حلويات", 25),
    ("sandwiches_salads", "ساندويتشات وسلطات", 26),
    ("boxes", "بوكسات", 11),
]
UNITS = ("حبة", "قطعة", "كوب", "علبة", "بوكس")


def clean(text):
    text = unicodedata.normalize("NFKC", text).translate(str.maketrans("یىکھ", "ييكه"))
    return re.sub(r"\s+", " ", text).strip()


doc = fitz.open(SOURCE)
assert len(doc) == 4, len(doc)
rows = []
RENDER.mkdir(exist_ok=True)
for page_index, page in enumerate(doc):
    category_key, category_ar, expected = GROUPS[page_index]
    # Render cropped table, not the PDF text alone: these files are for visual audit.
    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=fitz.Rect(55, 69, 545, 87 + expected * 7.8))
    pix.save(str(RENDER / f"table-crop-{page_index + 1}.png"))
    blocks = [block for block in page.get_text("dict")["blocks"] if block["type"] == 0]
    numbered = [b for b in blocks[1:] if any(
        s["bbox"][0] > 530 for line in b["lines"] for s in line["spans"]
    )]
    assert len(numbered) == expected, (page_index, len(numbered))
    for ordinal, block in enumerate(numbered, 1):
        # A color emoji in bakery row 3 lives in a separate PDF text block.
        supplements = [b for b in blocks[1:] if b not in numbered and
                       abs(b["bbox"][1] - block["bbox"][1]) < 4]
        spans = [(s["bbox"][0], s["text"]) for b in [block] + supplements
                 for line in b["lines"] for s in line["spans"]]
        number = next((clean(text) for x, text in spans if x > 530), None)
        assert number == str(ordinal), (page_index, ordinal, spans)
        # The PDF mixes independent RTL and LTR text in a single span. Code and
        # Arabic name are attached without whitespace; split by the code grammar.
        primary = " ".join(text for x, text in spans if 390 < x < 530)
        match = re.match(r"^\s*((?:\d{6}|sk-\d+|sk\d+))\s*(.*?)\s*$", primary, re.I)
        assert match, (page_index, ordinal, primary)
        code, name = match.groups()
        # BiDi extraction emits the visually trailing pack descriptor first and
        # reverses Arabic/count ordering; the render shows it after the name.
        prefix = re.match(r"^\(\s*(?:حبات|حبة)?\s*\d+|^\(\s*وسط", clean(name))
        if prefix:
            descriptor, tail = clean(name).split(")", 1)
            descriptor = descriptor[1:].strip()
            descriptor = re.sub(r"^(حبات|حبة)\s*(\d+)$", r"\2 \1", descriptor)
            name = f"{tail.strip()} ({descriptor})"
        left = "".join(text for x, text in spans if x < 390)
        left = clean(left)
        unit_match = re.match(r"^(" + "|".join(UNITS) + r")\s*", left)
        assert unit_match, (page_index, ordinal, left)
        unit = unit_match.group(1)
        remainder = left[unit_match.end():]
        source_category = ("bakery " if page_index == 0 else "pastry " if page_index == 1 else "") + category_ar
        assert remainder.startswith(source_category), (page_index, ordinal, remainder, source_category)
        cashier = remainder[len(source_category):].strip()
        assert cashier and clean(name), (page_index, ordinal, spans)
        rows.append({
            "code": code,
            "name": clean(name),
            "cashier_alias": cashier,
            "category": category_key,
            "category_source": source_category,
            "unit": unit,
            "source": {"page": page_index + 1, "row": ordinal, "pdf": SOURCE.name},
        })

assert len(rows) == 102
assert len({r["code"] for r in rows}) == 102
assert Counter(r["category"] for r in rows) == dict((g[0], g[2]) for g in GROUPS)
assert set(r["unit"] for r in rows) <= set(UNITS)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
print("rows", len(rows), "categories", dict(Counter(r["category"] for r in rows)))
print("units", dict(Counter(r["unit"] for r in rows)))