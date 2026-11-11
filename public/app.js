// Pixel Art Atlas — viewer logic. Sprites are drawn by cropping atlas sheets
// in the browser; the API only serves metadata + on-demand PNGs.
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const moreBtn = document.getElementById("more-btn");
const LIMIT = 96;

const sheetCache = new Map();
function sheetImage(sheet) {
  if (!sheetCache.has(sheet)) {
    sheetCache.set(
      sheet,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `/atlases/sheet-${String(sheet).padStart(3, "0")}.webp`;
      })
    );
  }
  return sheetCache.get(sheet);
}

async function drawSprite(canvas, s, size) {
  const img = await sheetImage(s.sheet);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, s.x, s.y, 16, 16, 0, 0, size, size);
}

let state = { q: "", subject: "", offset: 0, total: 0, loading: false };

async function fetchPage(append) {
  if (state.loading) return;
  state.loading = true;
  statusEl.textContent = "Loading…";
  try {
    const params = new URLSearchParams({
      q: state.q,
      subject: state.subject,
      limit: String(LIMIT),
      offset: String(state.offset),
    });
    const r = await fetch(`/api/search?${params}`).then((x) => x.json());
    if (r.error) throw new Error(r.error);
    state.total = r.total;
    if (!append) grid.innerHTML = "";
    for (const s of r.results) grid.appendChild(card(s));
    state.offset += r.results.length;
    statusEl.textContent = state.q || state.subject
      ? `${state.total.toLocaleString()} sprites found — showing ${state.offset.toLocaleString()}`
      : `${state.total.toLocaleString()} sprites in the atlas — browsing in order`;
    moreBtn.classList.toggle("hidden", state.offset >= state.total);
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  } finally {
    state.loading = false;
  }
}

function card(s) {
  const el = document.createElement("div");
  el.className = "card";
  const cv = document.createElement("canvas");
  cv.width = 96;
  cv.height = 96;
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.textContent = s.caption;
  const subj = document.createElement("div");
  subj.className = "subj";
  subj.textContent = s.subject;
  el.append(cv, cap, subj);
  drawSprite(cv, s, 96);
  el.addEventListener("click", () => openModal(s));
  return el;
}

async function randomPage() {
  state.loading = true;
  statusEl.textContent = "Loading random sprites…";
  try {
    const r = await fetch(`/api/random?n=${LIMIT}`).then((x) => x.json());
    grid.innerHTML = "";
    for (const s of r.results) grid.appendChild(card(s));
    state.offset = 0;
    state.total = 0;
    moreBtn.classList.add("hidden");
    statusEl.textContent = "Random picks — hit Random again or search for something specific.";
  } finally {
    state.loading = false;
  }
}

// ---- modal ----
const modal = document.getElementById("modal");
let modalSprite = null;
async function openModal(s) {
  modalSprite = s;
  document.getElementById("m-caption").textContent = s.caption;
  document.getElementById("m-meta").textContent =
    `subject: ${s.subject} · id: ${s.id} · sheet ${s.sheet} · cell (${s.x}, ${s.y})`;
  const origin = location.origin;
  for (const [elId, scale] of [["m-png1", 1], ["m-png4", 4], ["m-png8", 8]]) {
    const a = document.getElementById(elId);
    a.href = `/api/sprite?id=${s.id}&scale=${scale}`;
    a.textContent = `PNG ×${scale}`;
  }
  document.getElementById("m-api").textContent = `${origin}/api/sprite?id=${s.id}&scale=4`;
  document.getElementById("m-atlas").textContent =
    `${origin}${s.atlas} — drawImage(img, ${s.x}, ${s.y}, 16, 16, …)`;
  document.getElementById("m-snippet").textContent =
`<img src="${origin}/api/sprite?id=${s.id}&scale=4" alt="${s.caption}">`;
  modal.classList.remove("hidden");
  await drawSprite(document.getElementById("modal-canvas"), s, 256);
}
document.getElementById("modal-close").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
document.getElementById("m-copy").addEventListener("click", async (e) => {
  await navigator.clipboard.writeText(`${location.origin}/api/sprite?id=${modalSprite.id}&scale=4`);
  e.target.textContent = "Copied!";
  setTimeout(() => (e.target.textContent = "Copy"), 1200);
});

// ================= VFX (pixelfx) =================
const vfxGrid = document.getElementById("vfx-grid");
const vfxStatus = document.getElementById("vfx-status");
let vfxAll = null;
let vfxFilter = { q: "", category: "" };

const anims = new Set();
function animLoop(t) {
  for (const a of anims) {
    const elapsed = t - a.start;
    const frameMs = 1000 / a.e.fps;
    let idx = Math.floor(elapsed / frameMs);
    if (a.e.loop) {
      idx %= a.e.frames;
    } else if (idx >= a.e.frames) {
      if (elapsed < a.e.frames * frameMs + 900) idx = a.e.frames - 1;
      else { a.start = t; idx = 0; }
    }
    if (idx !== a.last) {
      a.last = idx;
      const sx = (idx % a.e.columns) * a.e.frameWidth;
      const sy = Math.floor(idx / a.e.columns) * a.e.frameHeight;
      const box = a.canvas.width;
      const scale = Math.min(box / a.e.frameWidth, box / a.e.frameHeight);
      const dw = Math.round(a.e.frameWidth * scale);
      const dh = Math.round(a.e.frameHeight * scale);
      const ctx = a.canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, box, box);
      ctx.drawImage(a.img, sx, sy, a.e.frameWidth, a.e.frameHeight,
        Math.round((box - dw) / 2), Math.round((box - dh) / 2), dw, dh);
    }
  }
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

const vfxImgCache = new Map();
function vfxImage(e) {
  if (!vfxImgCache.has(e.id)) {
    vfxImgCache.set(e.id, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.sheet;
    }));
  }
  return vfxImgCache.get(e.id);
}

const visObserver = new IntersectionObserver((entries) => {
  for (const en of entries) {
    const a = en.target._anim;
    if (!a) continue;
    if (en.isIntersecting) { a.start = performance.now() - (a.last || 0) * (1000 / a.e.fps); anims.add(a); }
    else anims.delete(a);
  }
}, { rootMargin: "100px" });

async function registerAnim(canvas, e, autostart) {
  const img = await vfxImage(e);
  const a = { canvas, e, img, start: performance.now(), last: -1 };
  canvas._anim = a;
  if (autostart) anims.add(a);
  else visObserver.observe(canvas);
  return a;
}

function vfxCard(e) {
  const el = document.createElement("div");
  el.className = "card";
  const cv = document.createElement("canvas");
  cv.width = 144; cv.height = 144;
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.textContent = e.name;
  const subj = document.createElement("div");
  subj.className = "subj";
  subj.textContent = e.category;
  const badge = document.createElement("span");
  badge.className = "badge" + (e.loop ? "" : " once");
  badge.textContent = `${e.frames}f · ${e.fps}fps · ${e.loop ? "loop" : "once"}`;
  el.append(cv, cap, subj, badge);
  registerAnim(cv, e, false);
  el.addEventListener("click", () => openVfxModal(e));
  return el;
}

function renderVfx() {
  const words = vfxFilter.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = vfxAll.filter((e) => {
    if (vfxFilter.category && e.category !== vfxFilter.category) return false;
    const hay = `${e.id} ${e.name} ${e.category} ${e.desc} ${(e.tags || []).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  vfxGrid.innerHTML = "";
  for (const e of out) vfxGrid.appendChild(vfxCard(e));
  vfxStatus.textContent = `${out.length} effects${vfxFilter.category ? ` in ${vfxFilter.category}` : ""} — previews play live from the sheets`;
}

async function loadVfx() {
  if (vfxAll) return;
  vfxStatus.textContent = "Loading effects…";
  const page1 = await fetch("/api/vfx?limit=200&offset=0").then((x) => x.json());
  let all = page1.results;
  if (page1.total > all.length) {
    const page2 = await fetch(`/api/vfx?limit=200&offset=${all.length}`).then((x) => x.json());
    all = all.concat(page2.results);
  }
  vfxAll = all;
  const chips = document.getElementById("vfx-chips");
  const cats = [...new Set(all.map((e) => e.category))].sort();
  const mk = (label, cat) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip";
    c.textContent = label;
    c.addEventListener("click", () => { vfxFilter.category = cat; renderVfx(); });
    chips.appendChild(c);
  };
  mk("all categories", "");
  for (const cat of cats) mk(`${cat} · ${all.filter((e) => e.category === cat).length}`, cat);
  renderVfx();
}

// ---- VFX modal ----
const vfxModal = document.getElementById("vfx-modal");
let vfxModalAnim = null;
async function openVfxModal(e) {
  document.getElementById("v-name").textContent = e.name;
  document.getElementById("v-meta").textContent =
    `${e.id} · ${e.frames} frames · ${e.fps} fps · ${e.loop ? "loops" : "plays once"} · frame ${e.frameWidth}×${e.frameHeight}${e.act ? " · acted move" : ""}`;
  document.getElementById("v-desc").textContent = e.desc;
  document.getElementById("v-sheet").href = e.sheet;
  document.getElementById("v-json").href = e.json;
  const api = `${location.origin}/api/vfx?id=${e.id}`;
  document.getElementById("v-api").textContent = api;
  document.getElementById("v-copy").onclick = async (ev) => {
    await navigator.clipboard.writeText(api);
    ev.target.textContent = "Copied!";
    setTimeout(() => (ev.target.textContent = "Copy"), 1200);
  };
  document.getElementById("v-snippet").textContent =
`const fx = await fetch('${location.origin}${e.json}').then(r => r.json());
const img = new Image(); img.src = '${location.origin}${e.sheet}';
await img.decode();
// per frame i: drawImage(img, fx.frameRects[i].x, fx.frameRects[i].y,
//   fx.frameWidth, fx.frameHeight, dx, dy, fx.frameWidth, fx.frameHeight)
// advance i every 1000 / fx.fps ms${e.loop ? ", wrap at fx.frames" : ""}`;
  vfxModal.classList.remove("hidden");
  if (vfxModalAnim) anims.delete(vfxModalAnim);
  vfxModalAnim = await registerAnim(document.getElementById("vfx-canvas"), e, true);
}
document.getElementById("vfx-close").addEventListener("click", () => {
  vfxModal.classList.add("hidden");
  if (vfxModalAnim) anims.delete(vfxModalAnim);
});
vfxModal.addEventListener("click", (e) => {
  if (e.target === vfxModal) {
    vfxModal.classList.add("hidden");
    if (vfxModalAnim) anims.delete(vfxModalAnim);
  }
});
document.getElementById("vfx-form").addEventListener("submit", (e) => {
  e.preventDefault();
  vfxFilter.q = document.getElementById("vfx-q").value.trim();
  if (vfxAll) renderVfx();
});

// ---- tabs ----
const tabSprites = document.getElementById("tab-sprites");
const tabVfx = document.getElementById("tab-vfx");
function switchTab(vfx) {
  tabSprites.classList.toggle("active", !vfx);
  tabVfx.classList.toggle("active", vfx);
  document.getElementById("view-sprites").classList.toggle("hidden", vfx);
  document.getElementById("view-vfx").classList.toggle("hidden", !vfx);
  document.getElementById("search-form").classList.toggle("hidden", vfx);
  document.getElementById("chips").classList.toggle("hidden", vfx);
  document.getElementById("status").classList.toggle("hidden", vfx);
  if (vfx) loadVfx();
}
tabSprites.addEventListener("click", () => switchTab(false));
tabVfx.addEventListener("click", () => switchTab(true));

// ---- wiring ----
document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.q = document.getElementById("q").value.trim();
  state.subject = document.getElementById("subject").value.trim();
  state.offset = 0;
  fetchPage(false);
});
document.getElementById("random-btn").addEventListener("click", randomPage);
moreBtn.addEventListener("click", () => fetchPage(true));

(async function init() {
  try {
    const r = await fetch("/api/subjects").then((x) => x.json());
    const dl = document.getElementById("subject-list");
    for (const s of r.subjects) {
      const o = document.createElement("option");
      o.value = s.name;
      dl.appendChild(o);
    }
    const chips = document.getElementById("chips");
    for (const s of r.subjects.slice(0, 14)) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = `${s.name} · ${s.count}`;
      c.addEventListener("click", () => {
        document.getElementById("subject").value = s.name;
        document.getElementById("q").value = "";
        state.q = "";
        state.subject = s.name;
        state.offset = 0;
        fetchPage(false);
      });
      chips.appendChild(c);
    }
  } catch (_) { /* chips are decorative */ }
  fetchPage(false);
})();
