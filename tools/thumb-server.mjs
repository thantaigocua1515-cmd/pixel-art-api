// Static server for thumbnail rendering: serves the repo public/ dir and
// three.js from shot-tools node_modules, plus the /render.html harness page.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PUB = "/home/hatch/workspace/pixel-art-api/public";
const THREE = "/home/hatch/workspace/flash-revival/shot-tools/node_modules/three";
const PORT = 3200;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary",
  ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".ogg": "audio/ogg" };

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body style="margin:0;background:transparent">
<canvas id="c" width="288" height="288"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(288, 288);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f52, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 4, 2); scene.add(key);
const fill = new THREE.DirectionalLight(0xaac4ff, 0.5); fill.position.set(-3, 1.5, -2.5); scene.add(fill);
const loader = new GLTFLoader();
let current = null;
window.renderModel = async (url) => {
  if (current) { scene.remove(current); current = null; }
  const gltf = await loader.loadAsync(url);
  const obj = gltf.scene;
  current = obj;
  scene.add(obj);
  if (gltf.animations && gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(obj);
    const clip = gltf.animations[0];
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(Math.min(0.7, clip.duration * 0.35));
  }
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  obj.position.sub(center);
  const r = Math.max(sphere.radius, 0.001);
  const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.72;
  const dir = new THREE.Vector3(1, 0.52, 1.25).normalize();
  camera.position.copy(dir.multiplyScalar(dist));
  camera.near = dist / 100; camera.far = dist * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  return { meshes: gltf.scene.children.length, animations: gltf.animations.length };
};
window.ready = true;
</script></body></html>`;

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/render.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(PAGE);
  }
  let file;
  if (u.pathname.startsWith("/three/")) file = path.join(THREE, u.pathname.slice(7));
  else file = path.join(PUB, decodeURIComponent(u.pathname));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("thumb server on", PORT));
