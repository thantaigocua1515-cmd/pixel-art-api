// GET /api/info?id=123 — metadata for one sprite.
const { load, describe, sendJson } = require("./_lib");

module.exports = (req, res) => {
  try {
    const d = load();
    const url = new URL(req.url, "http://localhost");
    const id = parseInt(url.searchParams.get("id") || "", 10);
    if (!Number.isInteger(id) || id < 0 || id >= d.meta.count) {
      return sendJson(res, 404, { error: `sprite id out of range: ${url.searchParams.get("id")}` });
    }
    return sendJson(res, 200, describe(d, id), "public, max-age=86400");
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
