#!/usr/bin/env python3
"""Build the Sakuga UI integration for the Pixel Art Atlas API.

Source: github.com/finktheartist/sakuga-vfx (MIT) by Justin Finkelman —
11 anime-style UI components, each a single self-contained JS file that
defines a <sakuga-*> custom element (the shared core, the manga lettering
paths and, for the toggle, its 43 painted frames are all baked into the
files, so there are no runtime assets to copy besides the JS itself).

Copies data-raw/sakuga-ui-repo/<name>/<name>.js -> public/sakuga/<name>.js,
the repo LICENSE -> public/sakuga/LICENSE.txt, and writes
api/_data/sakuga_index.json from the repo's registry.json.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data-raw" / "sakuga-ui-repo"
OUT = ROOT / "public" / "sakuga"
DATA = ROOT / "api" / "_data"

# Live demo markup per component (mirrors the upstream gallery).
DEMOS = {
    "button": '<sakuga-button>Confirm</sakuga-button><sakuga-button variant="secondary">Secondary</sakuga-button>',
    "toggle": '<sakuga-toggle label="Notifications"></sakuga-toggle>',
    "slider": '<sakuga-slider value="30" label="Volume"></sakuga-slider>',
    "checkbox": "<sakuga-checkbox>Remember me</sakuga-checkbox>",
    "radio": '<sakuga-radio label="Plan"><option value="a" selected>Option A</option><option value="b">Option B</option><option value="c">Option C</option></sakuga-radio>',
    "input": '<sakuga-input label="Name" placeholder="Type something"></sakuga-input>',
    "tabs": '<sakuga-tabs label="Sections"><option>Home</option><option>Profile</option><option>Settings</option></sakuga-tabs>',
    "progress": '<sakuga-progress demo label="Loading"></sakuga-progress>',
    "rating": '<sakuga-rating label="Rating"></sakuga-rating>',
    "toast": '<sakuga-button variant="secondary" data-demo="save">Save</sakuga-button><sakuga-toast></sakuga-toast>',
    "tooltip": '<sakuga-tooltip text="Helpful hint!"></sakuga-tooltip>',
}


def main():
    registry = json.loads((SRC / "registry.json").read_text("utf8"))
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)

    entries = []
    for item in registry["items"]:
        name = item["name"]
        src_file = SRC / name / f"{name}.js"
        dst_file = OUT / f"{name}.js"
        shutil.copyfile(src_file, dst_file)
        demo = DEMOS[name]
        entries.append({
            "name": name,
            "title": item["title"],
            "element": f"sakuga-{name}",
            "description": item["description"],
            "docs": item["docs"],
            "demo": demo,
            "file": f"/sakuga/{name}.js",
            "bytes": dst_file.stat().st_size,
        })

    shutil.copyfile(SRC / "LICENSE", OUT / "LICENSE.txt")

    index = {
        "name": "Sakuga VFX — anime-style UI components",
        "author": "Justin Finkelman",
        "homepage": "https://sakuga-vfx.vercel.app",
        "repo": "https://github.com/finktheartist/sakuga-vfx",
        "license": "MIT",
        "licenseFile": "/sakuga/LICENSE.txt",
        "total": len(entries),
        "components": entries,
    }
    (DATA / "sakuga_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), "utf8"
    )
    total_kb = sum(e["bytes"] for e in entries) // 1024
    print(f"sakuga: {len(entries)} components, {total_kb} KB total -> public/sakuga/ + api/_data/sakuga_index.json")


if __name__ == "__main__":
    main()
