#!/usr/bin/env python3
"""Rescue Quaternius glTF files blocked by Google Drive's public quota:
copy each file into Khang's own Drive folder, then download the copy.
Resumable via data-raw/quaternius/drive-copies.json."""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = "1qPeIZpOHTn9-PocaRyJSmUenU65cGlKf"  # "Game Asset Library" in Khang's Drive
CLI = "/opt/hatch/bin/hatch_gws_cli"
MAP_PATH = ROOT / "data-raw" / "quaternius" / "drive-copies.json"
listing = json.loads((ROOT / "data-raw" / "quaternius-listing.json").read_text())
copies = {}
if MAP_PATH.exists():
    copies = json.loads(MAP_PATH.read_text())


def run(*args):
    r = subprocess.run([CLI, *args], capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        print("CLI FAIL:", r.stdout[:200], r.stderr[:200])
        return None


def main():
    todo = []
    for pack, files in listing.items():
        for f in files:
            todo.append((pack, f))
    print(len(todo), "files to rescue")
    for pack, f in todo:
        key = pack + "/" + f["path"]
        dest_dir = ROOT / "data-raw" / "quaternius" / pack
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / Path(f["path"]).name
        if key in copies and dest.exists():
            continue
        if key not in copies:
            name = pack + "__" + Path(f["path"]).name
            got = run("drive", "files", "copy",
                      "--params", json.dumps({"fileId": f["id"], "ignoreDefaultVisibility": True}),
                      "--json", json.dumps({"name": name, "parents": [FOLDER]}))
            if not got or "id" not in got:
                print("COPY FAIL", key)
                continue
            copies[key] = got["id"]
            MAP_PATH.write_text(json.dumps(copies, indent=1))
        if not dest.exists():
            got = run("drive", "files", "get",
                      "--params", json.dumps({"fileId": copies[key], "alt": "media"}),
                      "--output", str(dest))
            if not got or got.get("status") != "success":
                print("DOWNLOAD FAIL", key)
                continue
        print("ok", key, dest.stat().st_size, "B", flush=True)
    print("RESCUE DONE", len(copies), "copies mapped")


if __name__ == "__main__":
    main()
