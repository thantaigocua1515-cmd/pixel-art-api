// Local dev server that mimics Vercel's routing for this project:
// static files from public/, functions from api/*.js as (req, res) handlers.
// Usage: node tools/dev-server.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = parseInt(process.argv[2] || "3000", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
      const file = path.join(ROOT, "api", `${name}.js`);
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "no such function" }));
      }
      delete require.cache[require.resolve(file)];
      const handler = require(file);
      return await handler(req, res);
    }
    let rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.join(ROOT, "public", rel);
    if (!file.startsWith(path.join(ROOT, "public")) || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
});

server.listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
