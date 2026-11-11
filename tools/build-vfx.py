#!/usr/bin/env python3
"""Convert pixelfx sheet exports into the API's VFX layout.

Input : ~/workspace/library/pixelfx/sheets/{index.json, <cat>/<name>.png, <cat>/<name>.json}
Output:
  public/vfx/<cat>/<name>.webp   lossless WebP sheet (RGB under transparent pixels preserved)
  public/vfx/<cat>/<name>.json   compact sheet descriptor incl. frame rects
  api/_data/vfx_index.json       lightweight index for /api/vfx search
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path.home() / "workspace" / "library" / "pixelfx" / "sheets"
OUT = ROOT / "public" / "vfx"
DATA = ROOT / "api" / "_data"


def main() -> None:
    index = json.loads((SRC / "index.json").read_text(encoding="utf-8"))
    light_index = []
    total_bytes = 0
    for entry in index:
        fx_id = entry["id"]  # e.g. "fire/campfire"
        cat, name = fx_id.split("/", 1)
        sheet_json = json.loads((SRC / f"{fx_id}.json").read_text(encoding="utf-8"))
        frames = [
            {"x": f["frame"]["x"], "y": f["frame"]["y"], "w": f["frame"]["w"], "h": f["frame"]["h"]}
            for f in sheet_json["frames"]
        ]
        fw, fh = entry["frameSize"]
        cols = entry["columns"]
        rows = (len(frames) + cols - 1) // cols

        out_dir = OUT / cat
        out_dir.mkdir(parents=True, exist_ok=True)
        webp_path = out_dir / f"{name}.webp"
        img = Image.open(SRC / f"{fx_id}.png").convert("RGBA")
        img.save(webp_path, lossless=True, method=4, exact=True)
        total_bytes += webp_path.stat().st_size

        descriptor = {
            "id": fx_id,
            "name": entry["name"],
            "category": cat,
            "desc": entry["desc"],
            "tags": entry["tags"],
            "loop": entry["loop"],
            "fps": entry["fps"],
            "frames": len(frames),
            "frameWidth": fw,
            "frameHeight": fh,
            "columns": cols,
            "rows": rows,
            "pivot": entry["pivot"],
            "sheet": f"/vfx/{fx_id}.webp",
            "frameRects": frames,
        }
        if "act" in entry:
            descriptor["act"] = entry["act"]
        (out_dir / f"{name}.json").write_text(
            json.dumps(descriptor, ensure_ascii=False), encoding="utf-8"
        )

        light = {k: descriptor[k] for k in (
            "id", "name", "category", "desc", "tags", "loop", "fps", "frames",
            "frameWidth", "frameHeight", "columns", "rows", "pivot", "sheet",
        )}
        light["json"] = f"/vfx/{fx_id}.json"
        if "act" in descriptor:
            light["act"] = descriptor["act"]
        light_index.append(light)
        print(f"{fx_id}: {len(frames)}f @{entry['fps']}fps -> {webp_path.stat().st_size} B", flush=True)

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "vfx_index.json").write_text(
        json.dumps(light_index, ensure_ascii=False), encoding="utf-8"
    )
    cats = sorted({e["category"] for e in light_index})
    print(f"\n{len(light_index)} effects, categories: {cats}")
    print(f"total sheet bytes: {total_bytes / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
