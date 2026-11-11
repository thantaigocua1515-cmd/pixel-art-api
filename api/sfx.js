// GET /api/sfx?q=&group=&limit=&offset=   |   GET /api/sfx?id=<id>
// Sound effects: Kenney audio packs (CC0) + jsfxr generated presets (Unlicense).
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib.js");

let index = null;
function load() {
  if (!index) {
    index = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "sfx_index.json"), "utf8"));
  }
  return index;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;
  const all = load();

  if (q.get("id")) {
    const hit = all.find((e) => e.id === q.get("id"));
    return hit ? sendJson(res, 200, hit) : sendJson(res, 404, { error: "unknown sfx id" });
  }

  const group = q.get("group") || "";
  const words = (q.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.min(200, Math.max(1, parseInt(q.get("limit") || "60", 10) || 60));
  const offset = Math.max(0, parseInt(q.get("offset") || "0", 10) || 0);

  let out = all;
  if (group) out = out.filter((e) => e.group === group);
  if (words.length) {
    out = out.filter((e) => {
      const hay = (e.id + " " + e.name + " " + e.group + " " + (e.algo || "")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  const groups = [...new Set(all.map((e) => e.group))].sort();
  sendJson(res, 200, {
    total: out.length, offset, limit, groups,
    results: out.slice(offset, offset + limit),
  });
};
