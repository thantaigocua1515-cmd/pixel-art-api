# Pixel Art Atlas API

Search and hot-link **1,409,404 free 16×16 pixel-art sprites** (6,194 subjects), **244 animated VFX**, **841 sound effects**, **4,045 3D models** and **83 Kenney asset packs** through a tiny JSON API, with a built-in web viewer (one tab per collection).

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
| `GET /api/vfx?q=explosion&category=fire&limit=60&offset=0` | Search 244 animated VFX (pixelfx, MIT): name, desc, tags, fps, frame count/size, pivot, sheet links. |
| `GET /api/vfx?id=fire/campfire` | One effect's descriptor. Full sheet JSON (with per-frame rects) at `/vfx/fire/campfire.json`, sheet at `/vfx/fire/campfire.webp`. |
| `GET /api/sfx?q=coin&group=&limit=60&offset=0` | Search 841 sounds: Kenney CC0 audio packs + 88 jsfxr-generated presets (each with its sfxr.me `b58` code). Files (OGG) at the returned `url`. |
| `GET /api/sfx?id=kenney/interface-sounds/click_001` | One sound's metadata. |
| `GET /api/models?q=knight&source=kaykit&pack=&animated=1&limit=60&offset=0` | Search 4,045 GLB models (KayKit, Kenney kits, Quaternius — CC0): download URL, size, animation count, thumbnail sheet cell. |
| `GET /api/models?id=kaykit/character-pack-adventures/Knight` | One model's metadata. Kenney GLBs share a palette texture — keep the pack's `Textures/` folder beside them. |
| `GET /api/packs?q=ui&limit=60&offset=0` | Browse 40 Kenney 2D packs (CC0): sheets, individual tiles (small packs), contact sheets (large packs). |
| `GET /api/packs?id=kenney/ui-pack` | One pack's contents, incl. per-tile frame rects for contact-sheet packs. |

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
- `public/` — viewer (index.html, app.js, style.css) + `atlases/`, `vfx/`, `sfx/`, `models/` (+ `models/thumbs/` contact sheets), `packs/`, `vendor/` (model-viewer)
- `api/` — serverless functions; `_data/` holds the search index (inverted index over captions, caption blob, subject map — ~44 MB gzipped, bundled via `vercel.json` includeFiles) plus JSON indexes for VFX/SFX/models/packs
- `tools/` — `preprocess.py` (dataset → atlases + index), `dev-server.js`, and the collection builders: `fetch-kenney.py`, `build-sfx.py` + `bake-jsfxr.mjs`, `build-models.py` + `convert-models.mjs` + `blender-quaternius.py`, `build-packs2d.py`, `thumb-server.mjs` + `render-thumbs.mjs`

## Asset credits & licenses

- Sprites: Angais/pixel-art-atlas-1.4m — **CC0 1.0** (dataset author).
- VFX: [pixelfx](https://github.com/patch-gg/pixelfx) by Patch — **MIT**.
- SFX & 2D/3D packs: [Kenney](https://kenney.nl) — **CC0** (LICENSE.txt verified inside every downloaded pack).
- 3D models: [KayKit](https://github.com/KayKit-Game-Assets) by Kay Lousberg — **CC0**; [Quaternius](https://quaternius.com) — **CC0** (Ultimate Animated Character Pack via OpenGameArt, SHA-256 verified; FBX converted to GLB with Blender).
- Generated SFX presets: [jsfxr](https://github.com/chr15m/jsfxr) — **Unlicense**; the rendered sounds are original output.
- Note: Quaternius Monsters/Mech/Animals packs could not be mirrored yet (Google Drive download quota on the shared folders) — only the character pack is included for now.
