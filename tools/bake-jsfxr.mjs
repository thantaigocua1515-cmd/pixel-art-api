// Bake a deterministic jsfxr preset library: each algorithm x N variants,
// seeded RNG so the set is reproducible. Outputs WAVs + manifest.json.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/home/hatch/workspace/flash-revival/shot-tools/package.json");
const sfxrPkg = require("jsfxr");
const sfxr = sfxrPkg.sfxr || sfxrPkg;
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

// mulberry32 seeded RNG, swapped into Math.random during generation
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALGOS = ["pickupCoin", "powerUp", "laserShoot", "explosion", "hitHurt",
  "jump", "blipSelect", "click", "synth", "tone", "shoot", "random"];
const realRandom = Math.random;
const manifest = [];
for (const algo of ALGOS) {
  if (typeof sfxr.generate !== "function") throw new Error("no generate");
  for (let v = 1; v <= 8; v++) {
    Math.random = seeded(algo.length * 1000 + v * 77 + 13);
    let params;
    try { params = sfxr.generate(algo); } catch { Math.random = realRandom; continue; }
    Math.random = realRandom;
    params.sound_vol = 0.3;
    params.sample_rate = 44100;
    params.sample_size = 16;
    const wave = sfxr.toWave(params);
    const m = wave.dataURI.match(/^data:.+\/(.+);base64,(.*)$/);
    const buf = Buffer.from(m[2], "base64");
    const name = `${algo}-${v}`;
    fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
    let b58 = "";
    try { b58 = sfxr.b58encode(params); } catch {}
    manifest.push({ name, algo, variant: v, b58, wavBytes: buf.length });
    console.log("baked", name, buf.length, "B");
  }
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log("total", manifest.length);
