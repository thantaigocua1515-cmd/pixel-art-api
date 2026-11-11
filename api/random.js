// GET /api/random?n=24 — random sprite metadata.
const { load, describe, sendJson } = require("./_lib");

module.exports = (req, res) => {
  try {
    const d = load();
    const url = new URL(req.url, "http://localhost");
    const n = Math.min(200, Math.max(1, parseInt(url.searchParams.get("n") || "24", 10) || 24));
    const seen = new Set();
    const out = [];
    while (out.length < n) {
      const id = Math.floor(Math.random() * d.meta.count);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(describe(d, id));
    }
    return sendJson(res, 200, { results: out }, "no-store");
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
