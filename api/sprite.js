// GET /api/sprite?id=123&scale=4 — one sprite as a PNG (nearest-neighbour upscale).
// Crops the 16x16 cell out of its atlas sheet with sharp; the response is
// CDN-cached, so the crop cost is paid once per id+scale.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { load, rectOf, sendJson } = require("./_lib");

const atlasCache = new Map(); // sheet -> Buffer (bounded, warm instances only)

async function atlasBuffer(req, sheet) {
  if (atlasCache.has(sheet)) return atlasCache.get(sheet);
  const name = `sheet-${String(sheet).padStart(3, "0")}.webp`;
  const local = path.join(process.cwd(), "public", "atlases", name);
  let buf;
  if (fs.existsSync(local)) {
    buf = fs.readFileSync(local);
  } else {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const r = await fetch(`${proto}://${req.headers.host}/atlases/${name}`);
    if (!r.ok) throw new Error(`atlas fetch failed: ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  }
  if (atlasCache.size >= 4) atlasCache.clear();
  atlasCache.set(sheet, buf);
  return buf;
}

module.exports = async (req, res) => {
  try {
    const d = load();
    const url = new URL(req.url, "http://localhost");
    const id = parseInt(url.searchParams.get("id") || "", 10);
    const scale = Math.min(16, Math.max(1, parseInt(url.searchParams.get("scale") || "4", 10) || 4));
    if (!Number.isInteger(id) || id < 0 || id >= d.meta.count) {
      return sendJson(res, 404, { error: `sprite id out of range: ${url.searchParams.get("id")}` });
    }
    const { sheet, x, y } = rectOf(d, id);
    const atlas = await atlasBuffer(req, sheet);
    const png = await sharp(atlas)
      .extract({ left: x, top: y, width: d.meta.cell, height: d.meta.cell })
      .resize(d.meta.cell * scale, d.meta.cell * scale, { kernel: "nearest" })
      .png()
      .toBuffer();
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(png);
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
