// GET /api/packs?q=&limit=&offset=   |   GET /api/packs?id=kenney/<slug>
// Kenney 2D packs (CC0): sheets, individual tiles for small packs, and a
// generated contact sheet + frame rects for large packs.
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib.js");

let index = null;
function load() {
  if (!index) {
    index = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "packs_index.json"), "utf8"));
  }
  return index;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;
  const all = load();

  if (q.get("id")) {
    const hit = all.find((e) => e.id === q.get("id"));
    if (!hit) return sendJson(res, 404, { error: "unknown pack id" });
    const out = { ...hit };
    if (hit.contact) {
      try {
        out.frames = JSON.parse(fs.readFileSync(
          path.join(__dirname, "_data", "packframes", hit.slug + ".json"), "utf8"));
      } catch { /* frames missing */ }
    }
    return sendJson(res, 200, out);
  }

  const words = (q.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "60", 10) || 60));
  const offset = Math.max(0, parseInt(q.get("offset") || "0", 10) || 0);
  let out = all;
  if (words.length) {
    out = out.filter((e) => {
      const hay = (e.id + " " + e.title).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  sendJson(res, 200, { total: out.length, offset, limit, results: out.slice(offset, offset + limit) });
};
