# Pixel Art Atlas API

Search and hot-link **1,409,404 free 16×16 pixel-art sprites** (6,194 subjects) through a tiny JSON/PNG API, with a built-in web viewer.

- **Live viewer:** search by caption words or subject, click any sprite for PNG links and atlas coordinates.
- **Data source:** [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) on Hugging Face — AI-generated sprites (Krea 2 Turbo + pixel-art LoRA) released by the dataset author under **CC0 1.0**. Captions are approximate; the release does not grant rights in third-party material or trademarks.
- **Stack:** static atlas sheets (WebP) + Node serverless functions on Vercel. No database, no API key.

## Endpoints

| Route | Description |
|---|---|
| `GET /api/search?q=gold+sword&subject=&limit=60&offset=0` | Full-text search over captions + subject names. Returns `{total, results: [{id, caption, subject, sheet, x, y, atlas, png}]}` |
| `GET /api/sprite?id=123&scale=4` | One sprite as PNG, nearest-neighbour upscaled (scale 1–16). Immutable CDN cache — hot-link it in your game. |
| `GET /api/info?id=123` | Metadata for one sprite (JSON). |
| `GET /api/subjects` | All 6,194 subjects with sprite counts. |
| `GET /api/random?n=24` | Random sprites. |
| `GET /atlases/sheet-000.webp` | Raw atlas sheets: 2048×2048 WebP, 128×128 grid of 16×16 sprites. |

Sprite → atlas mapping: `sheet = floor(id / 16384)`, `x = (id mod 128) * 16`, `y = floor((id mod 16384) / 128) * 16`.

## Game usage (canvas)

```js
const r = await fetch('/api/search?q=potion&limit=24').then(r => r.json());
const s = r.results[0];
const img = new Image();
img.src = s.atlas;                 // /atlases/sheet-003.webp
await img.decode();
ctx.imageSmoothingEnabled = false;
ctx.drawImage(img, s.x, s.y, 16, 16, 0, 0, 64, 64);
```

## Rebuild the data

```bash
# download pixel-art-16x16-1.4m.zip from the dataset page into data/
unzip pixel-art-16x16-1.4m.zip -d data/raw
python3 tools/preprocess.py   # writes public/atlases/*.webp and api/_data/*
npm install                   # sharp, used by /api/sprite
node tools/dev-server.js      # local dev server on :3000
```

Layout:
- `public/` — viewer (index.html, app.js, style.css) + `atlases/`
- `api/` — serverless functions; `_data/` holds the search index (inverted index over captions, caption blob, subject map — ~44 MB gzipped, bundled via `vercel.json` includeFiles)
- `tools/` — `preprocess.py` (dataset → atlases + index), `dev-server.js`
