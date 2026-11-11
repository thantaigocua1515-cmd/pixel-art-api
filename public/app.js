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
