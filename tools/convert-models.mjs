// Batch-convert .gltf -> .glb in one Node process via gltf-pipeline's API.
// Usage: node tools/convert-models.mjs jobs.json   jobs: [{in, out}]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("/home/hatch/workspace/flash-revival/shot-tools/package.json");
const gltfPipeline = require("gltf-pipeline");

const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let ok = 0, fail = 0;
for (const job of jobs) {
  try {
    const gltf = JSON.parse(fs.readFileSync(job.in, "utf8"));
    const res = await gltfPipeline.gltfToGlb(gltf, {
      resourceDirectory: path.dirname(job.in),
    });
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    fs.writeFileSync(job.out, res.glb);
    ok++;
  } catch (e) {
    fail++;
    console.log("FAIL", job.in, String(e.message || e).slice(0, 120));
  }
  if ((ok + fail) % 250 === 0) console.log(`... ${ok + fail}/${jobs.length} (ok ${ok}, fail ${fail})`);
}
console.log(`CONVERT DONE ok=${ok} fail=${fail}`);
