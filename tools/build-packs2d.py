#!/usr/bin/env python3
"""Build the Kenney 2D tab data (v2).
Per pack: cover + native spritesheets always shipped. Individual PNGs when
pack PNG count <= 300. Bigger packs get ONE generated contact sheet + frames.
-> public/packs/<slug>/... + api/_data/packs_index.json + api/_data/packframes/"""
import json, math, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "packs"
FRAMES_DIR = ROOT / "api" / "_data" / "packframes"
MANIFEST = json.loads((ROOT / "data-raw" / "kenney" / "manifest.json").read_text())
EXTRACT = ROOT / "data-raw" / "extract"
SMALL_LIMIT = 300


def is_sheet(name):
    n = name.lower()
    return "spritesheet" in n or n.endswith("_sheet.png") or "sheet" in Path(n).stem.lower()


MAX_CELL = 160
BIG_DIM = 512


def contact_sheet(slug, pngs, dest_dir):
    """Two-pass, low-memory montage. Returns (meta, big_files)."""
    sized = []
    big = []
    for f in pngs:
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception:
            continue
        if w > BIG_DIM or h > BIG_DIM:
            big.append(f)
        else:
            sized.append((f, w, h))
    if not sized:
        return None, big
    cell_w = min(max(w for _, w, _ in sized), MAX_CELL)
    cell_h = min(max(h for _, _, h in sized), MAX_CELL)
    cols = max(1, min(56, math.ceil(math.sqrt(len(sized) * cell_h / max(cell_w, 1)))))
    rows = math.ceil(len(sized) / cols)
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (0, 0, 0, 0))
    frames = []
    for i, (f, w, h) in enumerate(sized):
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        with Image.open(f) as im:
            im = im.convert("RGBA")
            if w > cell_w or h > cell_h:
                im = im.resize((min(w, cell_w), min(h, cell_h)))
            sheet.alpha_composite(im, (x, y))
            frames.append({"file": f.name, "x": x, "y": y, "w": im.width, "h": im.height})
    out = dest_dir / "contact-sheet.png"
    sheet.save(out, optimize=True)
    sheet.close()
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    meta = {"cellWidth": cell_w, "cellHeight": cell_h, "columns": cols, "frames": frames}
    (FRAMES_DIR / (slug + ".json")).write_text(json.dumps(meta))
    return ({"url": "/packs/" + slug + "/contact-sheet.png", "count": len(frames),
             "cellWidth": cell_w, "cellHeight": cell_h, "columns": cols}, big)


def main():
    import zipfile
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    packs = []
    for slug, v in sorted(MANIFEST.items()):
        if v.get("status") != "ok" or v.get("category") != "2d":
            continue
        dest = EXTRACT / ("kenney2d-" + slug)
        if not dest.exists():
            zipfile.ZipFile(ROOT / "data-raw" / "kenney" / (slug + ".zip")).extractall(dest)
        pngs = sorted(dest.rglob("*.png"))
        sheets = [f for f in pngs if is_sheet(f.name)]
        covers = [f for f in pngs if f.name.lower() in ("preview.png", "sample.png")]
        dest_dir = OUT / slug
        dest_dir.mkdir(parents=True, exist_ok=True)

        def ship(f):
            rel = f.relative_to(dest)
            out = dest_dir / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            if not out.exists():
                out.write_bytes(f.read_bytes())
            return "/packs/" + slug + "/" + rel.as_posix()

        cover_url = ship(covers[0]) if covers else None
        sheet_urls = [ship(f) for f in sheets]
        tiles, contact = [], None
        if slug == "kenney-fonts":
            pass
        elif len(pngs) <= SMALL_LIMIT:
            tiles = [ship(f) for f in pngs]
        else:
            rest = [f for f in pngs if f not in sheets and f not in covers]
            contact, big = contact_sheet(slug, rest, dest_dir)
            for f in big:
                sheet_urls.append(ship(f))
        fonts = []
        for f in list(dest.rglob("*.ttf")) + list(dest.rglob("*.otf")):
            fonts.append(ship(f))
        if not cover_url and sheet_urls:
            cover_url = sheet_urls[0]
        packs.append({
            "id": "kenney/" + slug, "slug": slug,
            "title": slug.replace("-", " ").title(),
            "assets": v.get("assets"), "cover": cover_url,
            "sheets": sheet_urls, "tiles": tiles, "contact": contact,
            "fonts": fonts, "totalPngInPack": len(pngs),
        })
        print(slug + ": sheets " + str(len(sheet_urls)) + ", tiles " + str(len(tiles)) +
              ", contact " + (str(contact["count"]) if contact else "-"))
    (ROOT / "api" / "_data" / "packs_index.json").write_text(json.dumps(packs))
    nfiles = sum(1 for _ in OUT.rglob("*") if _.is_file())
    print("packs: " + str(len(packs)) + ", files shipped: " + str(nfiles))


if __name__ == "__main__":
    main()
