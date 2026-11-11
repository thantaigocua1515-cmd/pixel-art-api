#!/usr/bin/env python3
"""Fetch Kenney packs (CC0) via the site's own download-link flow.
Usage: python3 tools/fetch-kenney.py [audio|2d|3d ...]  (default: all)
Saves zips to data-raw/kenney/<slug>.zip and logs a manifest."""
import json, re, subprocess, sys, time
from pathlib import Path

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data-raw" / "kenney"
RAW.mkdir(parents=True, exist_ok=True)
JAR = "/tmp/kenney-jar.txt"

AUDIO = ["casino-audio", "digital-audio", "impact-sounds", "interface-sounds",
         "music-jingles", "rpg-audio", "sci-fi-sounds", "ui-audio",
         "voiceover-pack", "voiceover-pack-fighter"]
D3 = ["car-kit", "city-kit-industrial", "city-kit-roads", "cube-pets", "factory-kit",
      "graveyard-kit", "mini-characters", "mini-dungeon", "mini-forest", "mini-shop",
      "mini-skate", "modular-cave-kit", "modular-dungeon-kit", "modular-space-kit",
      "pirate-kit", "platformer-kit", "nature-kit", "fantasy-town-kit", "castle-kit",
      "furniture-kit", "survival-kit", "food-kit", "space-kit", "tower-defense-kit",
      "blaster-kit", "racing-kit", "holiday-kit", "train-kit", "military-kit",
      "underwater-kit", "farm-kit", "coaster-kit", "building-kit", "city-kit-commercial",
      "suburban-elements", "retro-fantasy-kit", "hexagon-kit"]
D2 = ["crosshair-pack", "desert-shooter-pack", "domino-pack", "fish-pack", "flag-pack",
      "input-prompts", "light-masks", "minimap-pack", "mobile-controls",
      "new-platformer-pack", "roguelike-characters", "scribble-platformer-expansion",
      "tiny-city", "tiny-factory", "tiny-farm", "tiny-town", "ui-pack",
      "ui-pack-rpg-expansion", "ui-pack-adventure", "ui-pack-sci-fi",
      "roguelike-rpg-pack", "roguelike-caves-and-dungeons", "pixel-platformer",
      "pixel-ui-pack", "toon-characters-1", "emotes-pack", "game-icons",
      "tiny-dungeon", "tiny-battle", "tiny-ski", "platformer-art-pixel",
      "hexagon-pack", "board-game-icons", "puzzle-pack-1", "scribble-platformer",
      "pixel-shooter-pack", "monster-builder-pack", "robot-pack", "space-shooter-remastered",
      "space-shooter-extension", "topdown-shooter-pack", "tower-defense-top-down",
      "isometric-minature-prototype", "medieval-rts", "kenney-fonts", "ui-pack-space-expansion"]


def curl(url, out=None, referer=None):
    cmd = ["curl", "-s", "-A", UA, "-b", JAR, "-c", JAR]
    if referer:
        cmd += ["-H", f"Referer: {referer}"]
    if out:
        cmd += ["-o", str(out)]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout


def main():
    groups = sys.argv[1:] or ["audio", "3d", "2d"]
    todo = []
    if "audio" in groups: todo += [("audio", s) for s in AUDIO]
    if "3d" in groups: todo += [("3d", s) for s in D3]
    if "2d" in groups: todo += [("2d", s) for s in D2]
    manifest = {}
    mf_path = RAW / "manifest.json"
    if mf_path.exists():
        manifest = json.loads(mf_path.read_text())
    for cat, slug in todo:
        dest = RAW / f"{slug}.zip"
        if slug in manifest and dest.exists():
            print(f"skip {slug} (done)")
            continue
        page_url = f"https://kenney.nl/assets/{slug}"
        html = curl(page_url)
        m = re.search(r"Download this package \(([\d,]+) assets\)", html)
        if not m:
            print(f"MISS {slug}: no download package on page")
            manifest[slug] = {"status": "miss"}
            continue
        count = int(m.group(1).replace(",", ""))
        hexid = f"assets/{slug}".encode().hex()
        resp = curl(f"https://kenney.nl/download-link/{hexid}", referer=page_url)
        try:
            url = json.loads(resp)["url"]
        except Exception:
            print(f"FAIL {slug}: download-link -> {resp[:80]}")
            manifest[slug] = {"status": "fail"}
            continue
        curl(url, out=dest)
        size = dest.stat().st_size if dest.exists() else 0
        ok = size > 1000 and dest.read_bytes()[:2] == b"PK"
        print(f"{'OK  ' if ok else 'BAD '} {slug}: {count} assets, {size/1e6:.1f} MB")
        manifest[slug] = {"status": "ok" if ok else "bad", "category": cat,
                          "assets": count, "bytes": size}
        mf_path.write_text(json.dumps(manifest, indent=1))
        time.sleep(0.5)
    mf_path.write_text(json.dumps(manifest, indent=1))
    ok = [s for s, v in manifest.items() if v.get("status") == "ok"]
    print(f"\ndone: {len(ok)} packs ok")


if __name__ == "__main__":
    main()
