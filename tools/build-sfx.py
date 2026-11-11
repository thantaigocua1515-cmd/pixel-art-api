#!/usr/bin/env python3
"""Build the SFX tab data: Kenney audio packs (OGG) + baked jsfxr set.
-> public/sfx/<group>/<name>.ogg + api/_data/sfx_index.json"""
import json, subprocess, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data-raw" / "kenney"
OUT = ROOT / "public" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)

PACK_TITLES = {
    "casino-audio": "Casino Audio", "digital-audio": "Digital Audio",
    "impact-sounds": "Impact Sounds", "interface-sounds": "Interface Sounds",
    "music-jingles": "Music Jingles", "rpg-audio": "RPG Audio",
    "sci-fi-sounds": "Sci-Fi Sounds", "ui-audio": "UI Audio",
    "voiceover-pack": "Voiceover Pack", "voiceover-pack-fighter": "Voiceover Pack (Fighter)",
}


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()), 2)
    except Exception:
        return None


def main():
    entries = []
    for slug, title in PACK_TITLES.items():
        zpath = RAW / f"{slug}.zip"
        if not zpath.exists():
            print("missing zip", slug)
            continue
        z = zipfile.ZipFile(zpath)
        dest_dir = OUT / slug
        dest_dir.mkdir(exist_ok=True)
        n = 0
        for name in z.namelist():
            if not name.lower().endswith((".ogg", ".mp3", ".wav")):
                continue
            flat = Path(name).name
            dest = dest_dir / flat
            if not dest.exists():
                dest.write_bytes(z.read(name))
            entries.append({
                "id": "kenney/" + slug + "/" + dest.stem,
                "name": dest.stem.replace("_", " "),
                "group": "Kenney - " + title,
                "source": "kenney",
                "pack": slug,
                "url": "/sfx/" + slug + "/" + flat,
                "bytes": dest.stat().st_size,
                "seconds": duration(dest),
            })
            n += 1
        print(slug + ": " + str(n) + " sounds")

    staging = ROOT / "data-raw" / "jsfxr"
    man = staging / "manifest.json"
    if man.exists():
        dest_dir = OUT / "jsfxr"
        dest_dir.mkdir(exist_ok=True)
        for item in json.loads(man.read_text()):
            wav = staging / (item["name"] + ".wav")
            ogg = dest_dir / (item["name"] + ".ogg")
            if wav.exists() and not ogg.exists():
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav),
                                "-c:a", "libvorbis", "-q:a", "4", str(ogg)], check=True)
            if ogg.exists():
                entries.append({
                    "id": "jsfxr/" + item["name"],
                    "name": item["name"].replace("-", " - variant "),
                    "group": "jsfxr - generated",
                    "source": "jsfxr",
                    "pack": "jsfxr",
                    "url": "/sfx/jsfxr/" + item["name"] + ".ogg",
                    "bytes": ogg.stat().st_size,
                    "seconds": duration(ogg),
                    "b58": item.get("b58", ""),
                    "algo": item["algo"],
                })
        print("jsfxr baked set included")

    entries.sort(key=lambda e: (e["group"], e["name"]))
    (ROOT / "api" / "_data" / "sfx_index.json").write_text(json.dumps(entries))
    total = sum(e["bytes"] for e in entries)
    print(str(len(entries)) + " sounds, " + str(round(total / 1e6, 1)) + " MB -> sfx_index.json")


if __name__ == "__main__":
    main()
