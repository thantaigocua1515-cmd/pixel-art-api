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
const VIEWS = ["sprites", "vfx", "sfx", "models", "packs"];
function switchView(name) {
  for (const mid of ["modal", "vfx-modal", "model-modal", "pack-modal"]) {
    document.getElementById(mid).classList.add("hidden");
  }
  stopAudio();
  for (const v of VIEWS) {
    document.getElementById("tab-" + v).classList.toggle("active", v === name);
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  }
  const hero = name === "sprites";
  document.getElementById("search-form").classList.toggle("hidden", !hero);
  document.getElementById("chips").classList.toggle("hidden", !hero);
  document.getElementById("status").classList.toggle("hidden", !hero);
  if (name === "vfx") loadVfx();
  if (name === "sfx") loadSfx();
  if (name === "models") loadModels();
  if (name === "packs") loadPacks();
}
for (const v of VIEWS) {
  document.getElementById("tab-" + v).addEventListener("click", () => switchView(v));
}

// ================= SFX =================
let sfxAll = null;
let sfxFilter = { q: "", group: "" };
let curAudio = null, curBtn = null;

function stopAudio() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  if (curBtn) { curBtn.textContent = "▶"; curBtn = null; }
}

function sfxCard(e) {
  const el = document.createElement("div");
  el.className = "card sfx-card";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "play";
  btn.textContent = "▶";
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (curBtn === btn) { stopAudio(); return; }
    stopAudio();
    curAudio = new Audio(e.url);
    curBtn = btn;
    btn.textContent = "⏸";
    curAudio.addEventListener("ended", stopAudio);
    curAudio.play();
  });
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.textContent = e.name;
  const subj = document.createElement("div");
  subj.className = "subj";
  subj.textContent = e.group.replace("Kenney - ", "").replace("jsfxr - ", "jsfxr · ");
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${e.seconds != null ? e.seconds.toFixed(2) + "s" : ""} · ${Math.max(1, Math.round(e.bytes / 1024))} KB`;
  const dl = document.createElement("a");
  dl.className = "mini-link";
  dl.href = e.url;
  dl.textContent = "OGG ↓";
  dl.addEventListener("click", (ev) => ev.stopPropagation());
  el.append(btn, cap, subj, badge, dl);
  return el;
}

function renderSfx() {
  const grid = document.getElementById("sfx-grid");
  const words = sfxFilter.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = sfxAll.filter((e) => {
    if (sfxFilter.group && e.group !== sfxFilter.group) return false;
    const hay = `${e.id} ${e.name} ${e.group} ${e.algo || ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  grid.innerHTML = "";
  for (const e of out.slice(0, 240)) grid.appendChild(sfxCard(e));
  document.getElementById("sfx-status").textContent =
    `${out.length} sounds${out.length > 240 ? " (showing first 240 — refine the search)" : ""} — click ▶ to preview`;
}

async function loadSfx() {
  if (sfxAll) return;
  document.getElementById("sfx-status").textContent = "Loading sounds…";
  let all = [], total = Infinity, offset = 0, groups = [];
  while (all.length < total) {
    const r = await fetch(`/api/sfx?limit=200&offset=${offset}`).then((x) => x.json());
    total = r.total; groups = r.groups;
    all = all.concat(r.results);
    offset += r.results.length;
  }
  sfxAll = all;
  const chips = document.getElementById("sfx-chips");
  const mk = (label, g) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip";
    c.textContent = label;
    c.addEventListener("click", () => { sfxFilter.group = g; renderSfx(); });
    chips.appendChild(c);
  };
  mk("all groups", "");
  for (const g of groups) mk(`${g.replace("Kenney - ", "")} · ${all.filter((e) => e.group === g).length}`, g);
  renderSfx();
}
document.getElementById("sfx-form").addEventListener("submit", (e) => {
  e.preventDefault();
  sfxFilter.q = document.getElementById("sfx-q").value.trim();
  if (sfxAll) renderSfx();
});

// ================= 3D MODELS =================
let modelsState = { q: "", pack: "", animated: false, offset: 0, total: 0, packs: null };
const modelsLoaded = [];

function modelCard(m) {
  const el = document.createElement("div");
  el.className = "card";
  const box = document.createElement("div");
  box.className = "thumb";
  if (m.thumb) {
    const i = m.thumb.i;
    box.style.backgroundImage = `url(${m.thumb.sheet})`;
    box.style.backgroundSize = "1152px auto";
    box.style.backgroundPosition = `${-(i % 8) * 144}px ${-Math.floor(i / 8) * 144}px`;
  } else {
    box.textContent = "🧊";
    box.classList.add("thumb-empty");
  }
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.textContent = m.name;
  const subj = document.createElement("div");
  subj.className = "subj";
  subj.textContent = `${m.sourceTitle} · ${m.packTitle}`;
  el.append(box, cap, subj);
  if (m.animations > 0) {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = `▶ ${m.animations} animation${m.animations > 1 ? "s" : ""}`;
    el.appendChild(b);
  }
  const size = document.createElement("span");
  size.className = "badge once";
  size.textContent = m.bytes > 1e6 ? (m.bytes / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(m.bytes / 1024)) + " KB";
  el.appendChild(size);
  el.addEventListener("click", () => openModelModal(m));
  return el;
}

async function fetchModelsPage() {
  const p = new URLSearchParams({ limit: "96", offset: String(modelsState.offset) });
  if (modelsState.q) p.set("q", modelsState.q);
  if (modelsState.pack) p.set("pack", modelsState.pack);
  if (modelsState.animated) p.set("animated", "1");
  const r = await fetch("/api/models?" + p).then((x) => x.json());
  modelsState.total = r.total;
  if (!modelsState.packs) {
    modelsState.packs = r.packs;
    const chips = document.getElementById("models-chips");
    const mk = (label, pack) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = label;
      c.addEventListener("click", () => { modelsState.pack = pack; resetModels(); });
      chips.appendChild(c);
    };
    mk("all packs", "");
    for (const pk of r.packs) mk(`${pk.sourceTitle} · ${pk.packTitle} (${pk.count})`, pk.pack);
  }
  const grid = document.getElementById("models-grid");
  for (const m of r.results) { modelsLoaded.push(m); grid.appendChild(modelCard(m)); }
  modelsState.offset += r.results.length;
  document.getElementById("models-status").textContent =
    `${modelsState.total} models — showing ${modelsState.offset}`;
  document.getElementById("models-more").classList.toggle("hidden", modelsState.offset >= modelsState.total);
}

function resetModels() {
  modelsState.offset = 0;
  modelsLoaded.length = 0;
  document.getElementById("models-grid").innerHTML = "";
  fetchModelsPage();
}

let modelsStarted = false;
function loadModels() {
  if (modelsStarted) return;
  modelsStarted = true;
  fetchModelsPage();
}
document.getElementById("models-form").addEventListener("submit", (e) => {
  e.preventDefault();
  modelsState.q = document.getElementById("models-q").value.trim();
  modelsState.animated = document.getElementById("models-anim").checked;
  resetModels();
});
document.getElementById("models-more").addEventListener("click", fetchModelsPage);

// ---- model modal ----
let mvLoaded = false;
async function openModelModal(m) {
  if (!mvLoaded) {
    await import("/vendor/model-viewer.min.js");
    mvLoaded = true;
  }
  const mv = document.getElementById("model-viewer");
  mv.setAttribute("src", m.url);
  mv.setAttribute("alt", m.name);
  document.getElementById("m3-name").textContent = m.name;
  document.getElementById("m3-meta").textContent =
    `${m.id} · ${m.sourceTitle} · ${m.packTitle} · ${m.bytes > 1e6 ? (m.bytes / 1e6).toFixed(2) + " MB" : Math.round(m.bytes / 1024) + " KB"}${m.animations ? ` · ${m.animations} animations (auto-playing)` : ""}`;
  document.getElementById("m3-file").href = m.url;
  document.getElementById("m3-tex").innerHTML = m.source === "kenney"
    ? `· shared palette: <a href="/models/kenney/${m.pack}/Textures/colormap.png" target="_blank" rel="noopener">Textures/colormap.png</a> (keep beside the GLB)`
    : "";
  const api = `${location.origin}/api/models?id=${m.id}`;
  document.getElementById("m3-api").textContent = api;
  document.getElementById("m3-copy").onclick = async (ev) => {
    await navigator.clipboard.writeText(api);
    ev.target.textContent = "Copied!";
    setTimeout(() => (ev.target.textContent = "Copy"), 1200);
  };
  document.getElementById("m3-snippet").textContent =
`import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltf = await new GLTFLoader().loadAsync('${location.origin}${m.url}');
scene.add(gltf.scene);${m.animations ? "\n// animations: gltf.animations — play with an AnimationMixer" : ""}`;
  document.getElementById("model-modal").classList.remove("hidden");
}
document.getElementById("model-close").addEventListener("click", () => {
  document.getElementById("model-modal").classList.add("hidden");
  document.getElementById("model-viewer").removeAttribute("src");
});
document.getElementById("model-modal").addEventListener("click", (e) => {
  if (e.target.id === "model-modal") document.getElementById("model-close").click();
});

// ================= KENNEY 2D PACKS =================
let packsAll = null;

function packSummary(p) {
  const parts = [];
  if (p.sheets.length) parts.push(`${p.sheets.length} sheet${p.sheets.length > 1 ? "s" : ""}`);
  if (p.tiles.length) parts.push(`${p.tiles.length} tiles`);
  if (p.contact) parts.push(`contact sheet · ${p.contact.count} tiles`);
  if (p.fonts.length) parts.push(`${p.fonts.length} fonts`);
  return parts.join(" · ") || `${p.totalPngInPack} PNG`;
}

function packCard(p) {
  const el = document.createElement("div");
  el.className = "card pack-card";
  if (p.cover) {
    const img = document.createElement("img");
    img.src = p.cover;
    img.alt = p.title;
    img.loading = "lazy";
    el.appendChild(img);
  }
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.textContent = p.title;
  const subj = document.createElement("div");
  subj.className = "subj";
  subj.textContent = packSummary(p);
  el.append(cap, subj);
  el.addEventListener("click", () => openPackModal(p));
  return el;
}

function renderPacks(q) {
  const grid = document.getElementById("packs-grid");
  const words = (q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const out = packsAll.filter((p) => {
    const hay = (p.id + " " + p.title).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  grid.innerHTML = "";
  for (const p of out) grid.appendChild(packCard(p));
  document.getElementById("packs-status").textContent = `${out.length} packs — all CC0 by Kenney`;
}

async function loadPacks() {
  if (packsAll) return;
  document.getElementById("packs-status").textContent = "Loading packs…";
  const r = await fetch("/api/packs?limit=200").then((x) => x.json());
  packsAll = r.results;
  renderPacks("");
}
document.getElementById("packs-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (packsAll) renderPacks(document.getElementById("packs-q").value.trim());
});

async function openPackModal(p) {
  const full = await fetch(`/api/packs?id=${p.id}`).then((x) => x.json());
  document.getElementById("pk-name").textContent = p.title;
  document.getElementById("pk-meta").textContent =
    `${p.id} · ${p.assets ? p.assets + " assets · " : ""}${packSummary(full)} · CC0`;
  const box = document.getElementById("pk-content");
  box.innerHTML = "";
  const section = (title) => {
    const h = document.createElement("h4");
    h.className = "pk-h";
    h.textContent = title;
    box.appendChild(h);
  };
  if (full.sheets.length) {
    section("Spritesheets");
    for (const s of full.sheets) {
      const a = document.createElement("a");
      a.href = s; a.target = "_blank"; a.rel = "noopener";
      const img = document.createElement("img");
      img.src = s; img.className = "pk-sheet"; img.loading = "lazy";
      a.appendChild(img);
      box.appendChild(a);
    }
  }
  if (full.fonts.length) {
    section("Fonts");
    for (const f of full.fonts) {
      const a = document.createElement("a");
      a.href = f; a.className = "mini-link"; a.textContent = f.split("/").pop() + " ↓";
      box.appendChild(a);
    }
  }
  const tileHost = document.createElement("div");
  tileHost.className = "pk-tiles";
  box.appendChild(tileHost);
  let shown = 0;
  const PAGE = 240;
  const moreBtn = document.createElement("button");
  moreBtn.className = "ghost";
  moreBtn.textContent = "Show more tiles";
  const addTiles = () => {
    if (full.tiles.length) {
      for (const t of full.tiles.slice(shown, shown + PAGE)) {
        const a = document.createElement("a");
        a.href = t; a.target = "_blank"; a.rel = "noopener";
        const img = document.createElement("img");
        img.src = t; img.loading = "lazy"; img.className = "pk-tile";
        a.appendChild(img);
        tileHost.appendChild(a);
      }
      shown += PAGE;
    } else if (full.contact && full.frames) {
      const fr = full.frames;
      const sheetW = Math.max(...fr.frames.map((f) => f.x + f.w));
      const sheetH = Math.max(...fr.frames.map((f) => f.y + f.h));
      for (const f of fr.frames.slice(shown, shown + PAGE)) {
        const s = Math.min(88 / f.w, 88 / f.h, 1.5);
        const cell = document.createElement("div");
        cell.className = "pk-cell";
        cell.title = f.file;
        const inner = document.createElement("div");
        inner.style.width = Math.round(f.w * s) + "px";
        inner.style.height = Math.round(f.h * s) + "px";
        inner.style.backgroundImage = `url(${full.contact.url})`;
        inner.style.backgroundSize = `${Math.round(sheetW * s)}px ${Math.round(sheetH * s)}px`;
        inner.style.backgroundPosition = `${-Math.round(f.x * s)}px ${-Math.round(f.y * s)}px`;
        cell.appendChild(inner);
        tileHost.appendChild(cell);
      }
      shown += PAGE;
    }
    const totalTiles = full.tiles.length || (full.frames ? full.frames.frames.length : 0);
    moreBtn.classList.toggle("hidden", shown >= totalTiles);
    if (totalTiles && !tileHost.previousElementSibling?.classList?.contains("pk-h")) {
      // heading inserted once by caller below
    }
  };
  const totalTiles = full.tiles.length || (full.frames ? full.frames.frames.length : 0);
  if (totalTiles) {
    section(full.tiles.length ? `Tiles (${totalTiles})` : `Tiles via contact sheet (${totalTiles}) — full sheet above in Sheets, rects via the API`);
    box.appendChild(tileHost);
    addTiles();
    box.appendChild(moreBtn);
    moreBtn.addEventListener("click", addTiles);
  }
  document.getElementById("pack-modal").classList.remove("hidden");
}
document.getElementById("pack-close").addEventListener("click", () => {
  document.getElementById("pack-modal").classList.add("hidden");
});
document.getElementById("pack-modal").addEventListener("click", (e) => {
  if (e.target.id === "pack-modal") document.getElementById("pack-close").click();
});

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
