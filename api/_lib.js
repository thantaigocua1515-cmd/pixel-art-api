// Shared data layer for the Pixel Art Atlas API.
// Data files in api/_data are produced by tools/preprocess.py and bundled
// into every function via vercel.json "includeFiles".
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DATA_DIR = path.join(process.cwd(), "api", "_data");

let cache = null;

function load() {
  if (cache) return cache;
  const read = (name) => fs.readFileSync(path.join(DATA_DIR, name));
  const meta = JSON.parse(read("meta.json").toString("utf8"));
  const subjects = JSON.parse(read("subjects.json").toString("utf8"));
  const indexDict = JSON.parse(read("index_dict.json").toString("utf8"));
  const readGz = (name) => zlib.gunzipSync(read(name));
  const postingsBuf = readGz("postings.bin.gz");
  const postings = new Uint32Array(
    postingsBuf.buffer,
    postingsBuf.byteOffset,
    postingsBuf.byteLength / 4
  );
  const subjBuf = readGz("subject_of_id.bin.gz");
  const subjectOfId = new Uint16Array(
    subjBuf.buffer,
    subjBuf.byteOffset,
    subjBuf.byteLength / 2
  );
  const captionsBlob = readGz("captions.bin.gz");
  const offBuf = readGz("caption_offsets.bin.gz");
  const captionOffsets = new Uint32Array(
    offBuf.buffer,
    offBuf.byteOffset,
    offBuf.byteLength / 4
  );
  const subjectByName = new Map();
  subjects.forEach((s, i) => subjectByName.set(s.name.toLowerCase(), i));
  cache = {
    meta,
    subjects,
    indexDict,
    indexWords: Object.keys(indexDict),
    postings,
    subjectOfId,
    captionsBlob,
    captionOffsets,
    subjectByName,
  };
  return cache;
}

function captionOf(d, id) {
  const a = d.captionOffsets[id];
  const b = d.captionOffsets[id + 1];
  return d.captionsBlob.toString("utf8", a, b);
}

function rectOf(d, id) {
  const sheet = Math.floor(id / d.meta.perSheet);
  const cell = id % d.meta.perSheet;
  return {
    sheet,
    x: (cell % d.meta.grid) * d.meta.cell,
    y: Math.floor(cell / d.meta.grid) * d.meta.cell,
  };
}

function describe(d, id) {
  const r = rectOf(d, id);
  return {
    id,
    caption: captionOf(d, id),
    subject: d.subjects[d.subjectOfId[id]].name,
    sheet: r.sheet,
    x: r.x,
    y: r.y,
    atlas: `/atlases/sheet-${String(r.sheet).padStart(3, "0")}.webp`,
    png: `/api/sprite?id=${id}`,
  };
}

function tokenize(q) {
  return [...new Set((q.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 2))];
}

// Union of posting lists for one query word (exact match, else prefix expansion).
function postingsForWord(d, word) {
  const hit = d.indexDict[word];
  if (hit) return d.postings.subarray(hit[0], hit[0] + hit[1]);
  const lists = [];
  for (const w of d.indexWords) {
    if (w.startsWith(word)) {
      const h = d.indexDict[w];
      lists.push(d.postings.subarray(h[0], h[0] + h[1]));
      if (lists.length >= 24) break;
    }
  }
  if (!lists.length) return new Uint32Array(0);
  const total = lists.reduce((s, l) => s + l.length, 0);
  const merged = new Uint32Array(total);
  let p = 0;
  for (const l of lists) {
    merged.set(l, p);
    p += l.length;
  }
  merged.sort();
  return merged;
}

function intersect(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

// Full-text search: intersect posting lists across all query words.
function searchIds(d, query) {
  const words = tokenize(query);
  if (!words.length) return null; // signals "no query"
  let acc = null;
  for (const w of words) {
    const list = postingsForWord(d, w);
    if (!list.length) return [];
    acc = acc === null ? Array.from(list) : intersect(acc, list);
    if (!acc.length) return [];
  }
  return acc;
}

function sendJson(res, status, obj, cacheControl) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl || "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

module.exports = { load, captionOf, rectOf, describe, tokenize, searchIds, sendJson };
