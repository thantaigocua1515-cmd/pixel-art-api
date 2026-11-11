#!/usr/bin/env python3
"""Preprocess the Angais/pixel-art-atlas-1.4m dataset into a Vercel-ready layout.

Input : data/raw/{tokens.npy, palette.npy, captions.json, objects.json}
Output:
  public/atlases/sheet-NNN.webp   2048x2048 WebP lossless, 128x128 grid of 16x16 sprites
  api/_data/meta.json             layout constants
  api/_data/subjects.json         [{name, count}] alphabetical
  api/_data/subject_of_id.bin.gz  uint16 subject index per sprite (gzip)
  api/_data/captions.bin.gz       concatenated caption UTF-8 bytes (gzip)
  api/_data/caption_offsets.bin.gz uint32 (N+1) offsets into captions.bin (gzip)
  api/_data/index_dict.json       {word: [offset, length]} into postings.bin.gz (uint32 units)
  api/_data/postings.bin.gz       uint32 sprite ids grouped by word (gzip)
Sprite id -> sheet = id // 16384, cell = id % 16384, x = (cell % 128) * 16, y = (cell // 128) * 16
"""
import gzip
import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
ATLASES = ROOT / "public" / "atlases"
DATA = ROOT / "api" / "_data"

GRID = 128
CELL = 16
PER = GRID * GRID  # 16384 sprites per sheet
SHEET_PX = GRID * CELL  # 2048

WORD_RE = re.compile(r"[a-z0-9]+")


def words_of(text: str):
    return [w for w in WORD_RE.findall(text.lower()) if len(w) >= 2]


def main() -> None:
    t_start = time.time()
    tokens = np.load(RAW / "tokens.npy", mmap_mode="r")
    palette = np.load(RAW / "palette.npy")
    captions = json.load(open(RAW / "captions.json", encoding="utf-8"))
    objects = json.load(open(RAW / "objects.json", encoding="utf-8"))
    n = len(captions)
    assert tokens.shape == (n, 256), tokens.shape
    assert len(objects) == n
    print(f"sprites: {n}", flush=True)

    # ---- atlases ----
    sheets = (n + PER - 1) // PER
    for s in range(sheets):
        out = ATLASES / f"sheet-{s:03d}.webp"
        if out.exists():
            print(f"sheet {s + 1}/{sheets} exists, skip", flush=True)
            continue
        lo, hi = s * PER, min(n, (s + 1) * PER)
        cnt = hi - lo
        rows = np.asarray(tokens[lo:hi]).astype(int)
        px = rows.reshape(cnt, CELL, CELL)
        rgb = palette[px]
        alpha = ((px != 0).astype(np.uint8) * 255)[..., None]
        rgba = np.concatenate([rgb, alpha], axis=3).astype(np.uint8)
        grid = np.zeros((PER, CELL, CELL, 4), dtype=np.uint8)
        grid[:cnt] = rgba
        sheet = (
            grid.reshape(GRID, GRID, CELL, CELL, 4)
            .transpose(0, 2, 1, 3, 4)
            .reshape(SHEET_PX, SHEET_PX, 4)
        )
        Image.fromarray(sheet, "RGBA").save(out, lossless=True, method=4, exact=True)
        print(f"sheet {s + 1}/{sheets} done ({out.stat().st_size} bytes)", flush=True)

    # ---- subjects ----
    counts = Counter(objects)
    subjects = sorted(counts.keys())
    subj_index = {name: i for i, name in enumerate(subjects)}
    subject_of_id = np.array([subj_index[o] for o in objects], dtype=np.uint16)
    (DATA / "subject_of_id.bin.gz").write_bytes(gzip.compress(subject_of_id.tobytes(), 9))
    json.dump(
        [{"name": name, "count": counts[name]} for name in subjects],
        open(DATA / "subjects.json", "w", encoding="utf-8"),
        ensure_ascii=False,
    )
    print(f"subjects: {len(subjects)}", flush=True)

    # ---- captions blob ----
    offsets = np.zeros(n + 1, dtype=np.uint32)
    parts = []
    pos = 0
    for i, cap in enumerate(captions):
        b = cap.encode("utf-8")
        parts.append(b)
        pos += len(b)
        offsets[i + 1] = pos
    (DATA / "captions.bin.gz").write_bytes(gzip.compress(b"".join(parts), 9))
    (DATA / "caption_offsets.bin.gz").write_bytes(gzip.compress(offsets.tobytes(), 9))
    print(f"captions blob: {pos} bytes", flush=True)

    # ---- inverted index over caption words + subject words ----
    postings = defaultdict(list)
    subj_words = {name: words_of(name) for name in subjects}
    for i in range(n):
        ws = set(words_of(captions[i]))
        ws.update(subj_words[objects[i]])
        for w in ws:
            postings[w].append(i)
        if (i + 1) % 200000 == 0:
            print(f"indexing {i + 1}/{n}", flush=True)
    words = sorted(postings.keys())
    index_dict = {}
    chunks = []
    offset = 0
    for w in words:
        ids = postings[w]
        index_dict[w] = [offset, len(ids)]
        chunks.append(np.array(ids, dtype=np.uint32))
        offset += len(ids)
    (DATA / "postings.bin.gz").write_bytes(gzip.compress(np.concatenate(chunks).tobytes(), 9))
    json.dump(index_dict, open(DATA / "index_dict.json", "w", encoding="utf-8"))
    print(f"index words: {len(words)}, postings: {offset}", flush=True)

    json.dump(
        {
            "count": n,
            "perSheet": PER,
            "grid": GRID,
            "cell": CELL,
            "sheetPx": SHEET_PX,
            "sheets": sheets,
            "subjects": len(subjects),
        },
        open(DATA / "meta.json", "w", encoding="utf-8"),
        indent=1,
    )
    print(f"ALL DONE in {time.time() - t_start:.0f}s", flush=True)


if __name__ == "__main__":
    sys.exit(main())
