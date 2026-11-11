#!/usr/bin/env python3
"""Build the 3D Models tab data.
Sources: KayKit (GitHub zips), Kenney 3D kits (zips).
-> public/models/<source>/<pack>/<Name>.glb + convert jobs + index (--index)"""
import json, re, struct, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACT = ROOT / "data-raw" / "extract"
OUT = ROOT / "public" / "models"
MANIFEST = json.loads((ROOT / "data-raw" / "kenney" / "manifest.json").read_text())
SOURCE_TITLES = {"kaykit": "KayKit", "kenney": "Kenney", "quaternius": "Quaternius"}


def pack_title(slug):
    return slug.replace("-", " ").title()


def sanitize(name):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


def collect():
    jobs = {}

    def add(source, pack, src_path):
        out = OUT / source / pack / (sanitize(src_path.stem) + ".glb")
        key = str(out)
        kind = "copy" if src_path.suffix.lower() == ".glb" else "convert"
        if key in jobs and jobs[key][0] == "copy":
            return
        jobs[key] = (kind, src_path)

    for zpath in sorted((ROOT / "data-raw" / "kaykit").glob("*.zip")):
        pack = zpath.stem.replace("KayKit-", "").replace("-1.0", "").lower()
        dest = EXTRACT / ("kaykit-" + pack)
        if not dest.exists():
            zipfile.ZipFile(zpath).extractall(dest)
        for f in dest.rglob("*"):
            if f.suffix.lower() in (".gltf", ".glb"):
                add("kaykit", pack, f)

    for slug, v in MANIFEST.items():
        if v.get("status") != "ok" or v.get("category") != "3d":
            continue
        dest = EXTRACT / ("kenney-" + slug)
        if not dest.exists():
            zipfile.ZipFile(ROOT / "data-raw" / "kenney" / (slug + ".zip")).extractall(dest)
        for f in dest.rglob("*"):
            if f.suffix.lower() in (".gltf", ".glb"):
                add("kenney", slug, f)
    return jobs


def glb_info(path):
    try:
        size = path.stat().st_size
        with open(path, "rb") as fh:
            head = fh.read(20)
            if head[:4] != b"glTF":
                return None
            jlen = struct.unpack("<I", head[12:16])[0]
            doc = json.loads(fh.read(jlen))
        return {"animations": len(doc.get("animations", [])),
                "meshes": len(doc.get("meshes", []))}
    except Exception:
        return None


def main():
    jobs = collect()
    conv = [{"in": str(src), "out": out} for out, (kind, src) in jobs.items() if kind == "convert"]
    (ROOT / "data-raw" / "convert-jobs.json").write_text(json.dumps(conv))
    copied = 0
    for out, (kind, src) in jobs.items():
        if kind == "copy":
            op = Path(out)
            op.parent.mkdir(parents=True, exist_ok=True)
            if not op.exists():
                op.write_bytes(src.read_bytes())
            copied += 1
    print("jobs: " + str(len(jobs)) + " total, " + str(copied) + " native glb copied, " + str(len(conv)) + " to convert")

    if "--index" in sys.argv:
        entries = []
        for op in sorted(OUT.rglob("*.glb")):
            rel = op.relative_to(OUT)
            source, pack = rel.parts[0], rel.parts[1]
            info = glb_info(op) or {"animations": 0, "meshes": 0}
            entries.append({
                "id": source + "/" + pack + "/" + op.stem,
                "name": op.stem.replace("_", " "),
                "source": source, "sourceTitle": SOURCE_TITLES[source],
                "pack": pack, "packTitle": pack_title(pack),
                "url": "/models/" + rel.as_posix(),
                "bytes": op.stat().st_size,
                "animations": info["animations"],
            })
        entries.sort(key=lambda e: (e["source"], e["pack"], e["name"]))
        (ROOT / "api" / "_data" / "models_index.json").write_text(json.dumps(entries))
        total = sum(e["bytes"] for e in entries)
        print("index: " + str(len(entries)) + " models, " + str(round(total / 1e6)) + " MB")


if __name__ == "__main__":
    main()
