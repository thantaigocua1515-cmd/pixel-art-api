// GET /api/search?q=brass+hook&subject=hook&limit=60&offset=0
// Full-text search over sprite captions + subject names (inverted index).
// Without q, browses the whole dataset (or one subject) in id order.
const { load, describe, searchIds, sendJson } = require("./_lib");

module.exports = (req, res) => {
  try {
    const d = load();
    const url = new URL(req.url, "http://localhost");
    const q = (url.searchParams.get("q") || "").trim();
    const subjectName = (url.searchParams.get("subject") || "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10) || 60));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

    let subjectIdx = -1;
    if (subjectName) {
      subjectIdx = d.subjectByName.get(subjectName);
      if (subjectIdx === undefined) {
        return sendJson(res, 404, { error: `unknown subject: ${subjectName}` });
      }
    }

    let ids;
    if (q) {
      ids = searchIds(d, q) || [];
      if (subjectIdx >= 0) ids = ids.filter((id) => d.subjectOfId[id] === subjectIdx);
    } else if (subjectIdx >= 0) {
      ids = [];
      for (let i = 0; i < d.meta.count; i++) {
        if (d.subjectOfId[i] === subjectIdx) ids.push(i);
      }
    } else {
      const total = d.meta.count;
      const page = [];
      for (let i = offset; i < Math.min(total, offset + limit); i++) page.push(describe(d, i));
      return sendJson(res, 200, { total, offset, limit, results: page });
    }

    const total = ids.length;
    const page = ids.slice(offset, offset + limit).map((id) => describe(d, id));
    return sendJson(res, 200, { total, offset, limit, results: page });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
