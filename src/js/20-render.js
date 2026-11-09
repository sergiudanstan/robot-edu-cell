// ================================================================ scene
const viewport = $("viewport");
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.domElement.classList.add("main");
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.35;
controls.maxDistance = 7;

// Lights live in scene space (y up). world is rotated -90° about x, as before.
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a837e, 0.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e8, 2.4);
sun.position.set(2.0, 3.4, 1.8);
sun.target.position.set(0, 0.3, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.002;
Object.assign(sun.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 0.5, far: 9 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);
const fillL = new THREE.DirectionalLight(0xdde6ff, 0.45);
fillL.position.set(-2.2, 1.6, -1.6);
scene.add(fillL);
const rimL = new THREE.DirectionalLight(0xffffff, 0.6);
rimL.position.set(-0.6, 2.4, 2.8);
scene.add(rimL);

const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;
scene.add(world);

// Room environment (no external HDR). PMREM runs before renderer.render is wrapped.
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
pmrem.dispose();
const roomGeos = new Set(), roomMats = new Set();
room.traverse((o) => {
  if (o.geometry) roomGeos.add(o.geometry);
  const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  list.forEach((m) => roomMats.add(m));
});
roomGeos.forEach((g) => g.dispose());
roomMats.forEach((m) => m.dispose());

function themeIsDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
function syncSceneTheme() {
  const bottom = css("--scene-bottom") || "#e4dfda";
  if (!scene.fog) scene.fog = new THREE.Fog(new THREE.Color(bottom), 7, 18);
  else scene.fog.color.set(bottom);
  scene.environmentIntensity = themeIsDark() ? 0.5 : 0.7;
}
syncSceneTheme();
window.addEventListener("themechange", syncSceneTheme);

// Composer: MSAA on the target (samples 4). Logical size is corrected just below —
// passing a pixel-sized target makes EffectComposer treat that size as CSS pixels.
function viewSize() {
  return { w: Math.max(1, viewport.clientWidth), h: Math.max(1, viewport.clientHeight) };
}
const view0 = viewSize();
const dpr0 = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr0);
renderer.setSize(view0.w, view0.h, false);
const composerTarget = new THREE.WebGLRenderTarget(Math.floor(view0.w * dpr0), Math.floor(view0.h * dpr0), {
  type: THREE.HalfFloatType,
  samples: 4,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.setSize(view0.w, view0.h);
const gtao = new GTAOPass(scene, camera, view0.w, view0.h);
gtao.updateGtaoMaterial({ radius: 0.15, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12 });
gtao.blendIntensity = 0.85;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(gtao);
composer.addPass(new OutputPass());

function fitComposer() {
  const { w, h } = viewSize();
  const dpr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
}
new ResizeObserver(fitComposer).observe(viewport);

function writeHqBox(on) {
  const box = document.getElementById("hq");
  if (box) box.checked = on;
  document.querySelectorAll("label.toggle").forEach((lab) => {
    if (lab.textContent.replace(/\s+/g, " ").trim() !== "HQ") return;
    const input = lab.querySelector("input");
    if (input) input.checked = on;
  });
}
let hq = true;
function shadowMapSize(px) {
  sun.shadow.mapSize.set(px, px);
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
}
function setQuality(on) {
  hq = !!on;
  try { localStorage.setItem("fanuc-edu-hq", hq ? "1" : "0"); } catch (e) {}
  gtao.enabled = hq;
  shadowMapSize(hq ? 4096 : 2048);
  renderer.setPixelRatio(hq ? Math.min(devicePixelRatio || 1, 2) : 1);
  fitComposer();
  writeHqBox(hq);
  return hq;
}
function storedHq() {
  try {
    const v = localStorage.getItem("fanuc-edu-hq");
    if (v === "0" || v === "1") return v === "1";
  } catch (e) {}
  return null;
}
function autoHq() {
  if (matchMedia("(pointer: coarse)").matches) return false;
  if (viewport.clientWidth > 0 && viewport.clientWidth < 900) return false;
  return true;
}
setQuality(storedHq() !== null ? storedHq() : autoHq());
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.id === "hq") setQuality(t.checked);
});

// frame() calls renderFrame(). Passes inside the composer call renderer.render directly.
let rendering = false;
let profilesArmed = false;
let watchT0 = 0, watchLast = 0, watchSum = 0, watchN = 0, watchDone = false;
function noteFrameTime() {
  if (watchDone) return;
  const now = performance.now();
  if (watchT0 === 0) { watchT0 = watchLast = now; return; }
  watchSum += now - watchLast;
  watchN += 1;
  watchLast = now;
  if (now - watchT0 < 3000) return;
  watchDone = true;
  const avg = watchN ? watchSum / watchN : 0;
  const tripped = avg > 28 && hq;
  if (tripped) setQuality(false);
  window.__hqStats = { avgMs: avg, tripped };
}
function renderFrame() {
  if (!profilesArmed) { profilesArmed = true; finalizeProfiles(); }
  if (rendering) return;
  rendering = true;
  try { composer.render(); }
  finally { rendering = false; }
  noteFrameTime();
}
window.setQuality = setQuality;
