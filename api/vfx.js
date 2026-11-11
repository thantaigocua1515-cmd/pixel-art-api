// GET /api/vfx?q=fire&category=magic&limit=60&offset=0 — search/list VFX.
// GET /api/vfx?id=fire/campfire — one effect's full descriptor.
// Data: api/_data/vfx_index.json (built by tools/build-vfx.py from the
// pixelfx library, MIT). Sheets + per-effect JSON live in public/vfx/.
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib");

let index = null;
function loadIndex() {
  if (!index) {
    index = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "api", "_data", "vfx_index.json"), "utf8")
    );
  }
  return index;
}

module.exports = (req, res) => {
  try {
    const list = loadIndex();
    const url = new URL(req.url, "http://localhost");
    const id = (url.searchParams.get("id") || "").trim().toLowerCase();
    if (id) {
      const hit = list.find((e) => e.id === id);
      if (!hit) return sendJson(res, 404, { error: `unknown vfx id: ${id}` });
      return sendJson(res, 200, hit, "public, max-age=86400");
    }
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10) || 60));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

    let out = list;
    if (category) out = out.filter((e) => e.category === category);
    if (q) {
      const words = q.split(/\s+/).filter(Boolean);
      out = out.filter((e) => {
        const hay = `${e.id} ${e.name} ${e.category} ${e.desc} ${(e.tags || []).join(" ")}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    const total = out.length;
    return sendJson(res, 200, {
      total,
      offset,
      limit,
      categories: [...new Set(list.map((e) => e.category))].sort(),
      results: out.slice(offset, offset + limit),
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
