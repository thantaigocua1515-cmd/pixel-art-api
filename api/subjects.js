// GET /api/subjects — all 6,194 subjects with sprite counts, biggest first.
const { load, sendJson } = require("./_lib");

module.exports = (req, res) => {
  try {
    const d = load();
    const list = d.subjects
      .map((s) => ({ name: s.name, count: s.count }))
      .sort((a, b) => b.count - a.count);
    return sendJson(
      res,
      200,
      { total: list.length, subjects: list },
      "public, max-age=86400"
    );
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
