// GET /api/models?q=&source=&pack=&animated=1&limit=&offset=  |  ?id=<id>
// 3D models (GLB): KayKit + Kenney kits + Quaternius, all CC0.
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib.js");

let index = null;
function load() {
  if (!index) {
    index = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "models_index.json"), "utf8"));
    try {
      const thumbs = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "thumbs_meta.json"), "utf8"));
      for (const m of index) if (thumbs[m.id]) m.thumb = thumbs[m.id];
    } catch { /* thumbs not built yet */ }
  }
  return index;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;
  const all = load();

  if (q.get("id")) {
    const hit = all.find((e) => e.id === q.get("id"));
    return hit ? sendJson(res, 200, hit) : sendJson(res, 404, { error: "unknown model id" });
  }

  const source = q.get("source") || "";
  const pack = q.get("pack") || "";
  const animated = q.get("animated") === "1";
  const words = (q.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "60", 10) || 60));
  const offset = Math.max(0, parseInt(q.get("offset") || "0", 10) || 0);

  let out = all;
  if (source) out = out.filter((e) => e.source === source);
  if (pack) out = out.filter((e) => e.pack === pack);
  if (animated) out = out.filter((e) => e.animations > 0);
  if (words.length) {
    out = out.filter((e) => {
      const hay = (e.id + " " + e.name + " " + e.packTitle + " " + e.sourceTitle).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  const packs = {};
  for (const m of all) {
    const k = m.source + "/" + m.pack;
    packs[k] = packs[k] || { source: m.source, sourceTitle: m.sourceTitle, pack: m.pack, packTitle: m.packTitle, count: 0 };
    packs[k].count++;
  }
  sendJson(res, 200, {
    total: out.length, offset, limit,
    packs: Object.values(packs).sort((a, b) => (a.source + a.pack).localeCompare(b.source + b.pack)),
    results: out.slice(offset, offset + limit),
  });
};
