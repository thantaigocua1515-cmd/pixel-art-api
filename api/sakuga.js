// GET /api/sakuga — all Sakuga UI components (name, element, docs, file).
// GET /api/sakuga?name=button — one component's full descriptor.
// Data: api/_data/sakuga_index.json (built by tools/build-sakuga.py from
// github.com/finktheartist/sakuga-vfx, MIT). The component files themselves
// are self-contained and live in public/sakuga/.
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib");

let index = null;
function loadIndex() {
  if (!index) {
    index = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "api", "_data", "sakuga_index.json"), "utf8")
    );
  }
  return index;
}

module.exports = (req, res) => {
  try {
    const idx = loadIndex();
    const url = new URL(req.url, "http://localhost");
    const name = (url.searchParams.get("name") || "").trim().toLowerCase();
    if (name) {
      const hit = idx.components.find((c) => c.name === name);
      if (!hit) return sendJson(res, 404, { error: `unknown sakuga component: ${name}` });
      return sendJson(res, 200, hit, "public, max-age=86400");
    }
    return sendJson(res, 200, idx, "public, max-age=86400");
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
