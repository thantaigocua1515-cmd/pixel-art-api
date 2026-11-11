// Render model thumbnails: one contact sheet (8x8 cells of 288px) per
// source/pack group. Resumable via data-raw/thumb-progress.json.
// Usage: node tools/render-thumbs.mjs [groupFilter]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/home/hatch/workspace/flash-revival/shot-tools/package.json");
const puppeteer = require("puppeteer");
const sharp = require("/home/hatch/workspace/pixel-art-api/node_modules/sharp");

const ROOT = "/home/hatch/workspace/pixel-art-api";
const CELL = 288, COLS = 8, PER_SHEET = 64;
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_data/models_index.json"), "utf8"));
const progressPath = path.join(ROOT, "data-raw/thumb-progress.json");
let progress = { groups: {}, thumbs: {} };
if (fs.existsSync(progressPath)) progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
const thumbsDir = path.join(ROOT, "public/models/thumbs");
fs.mkdirSync(thumbsDir, { recursive: true });

const groups = new Map();
for (const m of index) {
  const key = m.source + "/" + m.pack;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(m);
}
const filter = process.argv[2] || "";
const todo = [...groups.entries()].filter(([k]) => !progress.groups[k] && k.includes(filter));
console.log("groups total", groups.size, "| todo", todo.length);

const browser = await puppeteer.launch({ headless: "new", timeout: 120000, protocolTimeout: 300000,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function renderGroup(page, key, models) {
  const sheets = Math.ceil(models.length / PER_SHEET);
  for (let s = 0; s < sheets; s++) {
    const chunk = models.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rows = Math.ceil(chunk.length / COLS);
    const W = COLS * CELL, H = rows * CELL;
    const blank = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    let canvas = sharp(blank);
    const composites = [];
    for (let i = 0; i < chunk.length; i++) {
      const m = chunk[i];
      try {
        await page.evaluate((u) => window.renderModel(u), "http://localhost:3200" + m.url);
        const shot = await page.screenshot({ clip: { x: 0, y: 0, width: CELL, height: CELL }, omitBackground: true });
        composites.push({ input: shot, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL });
        progress.thumbs[m.id] = { sheet: "", i: s * PER_SHEET + i };
      } catch (e) {
        console.log("  skip", m.id, String(e.message || e).slice(0, 80));
        progress.thumbs[m.id] = null;
      }
    }
    const sheetName = key.replace("/", "-") + "-" + s + ".webp";
    if (composites.length) {
      await sharp(blank).composite(composites).webp({ lossless: true }).toFile(path.join(thumbsDir, sheetName));
    }
    for (let i = 0; i < chunk.length; i++) {
      const t = progress.thumbs[chunk[i].id];
      if (t) t.sheet = "/models/thumbs/" + sheetName;
    }
    console.log(key, "sheet", s, "done (" + chunk.length + " models)");
  }
  progress.groups[key] = true;
  fs.writeFileSync(progressPath, JSON.stringify(progress));
}

const page = await browser.newPage();
await page.setViewport({ width: CELL, height: CELL });
await page.goto("http://localhost:3200/render.html", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction("window.ready === true", { timeout: 30000 });
for (const [key, models] of todo) {
  try { await renderGroup(page, key, models); }
  catch (e) { console.log("GROUP FAIL", key, String(e.message || e).slice(0, 120)); }
}
fs.writeFileSync(path.join(ROOT, "api/_data/thumbs_meta.json"), JSON.stringify(progress.thumbs));
await browser.close();
console.log("THUMBS DONE");
