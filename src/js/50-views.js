// Camera views. three.js scene is y-up; the cell group `world` is rotated -90° about x,
// so a cell point (x, y, z) is the scene point (x, z, -y).
function cellToScene(x, y, z) { return V(x, z, -y); }

const views = {
  iso: { pos: cellToScene(1.35, -1.55, 1.05), target: cellToScene(0.0, 0.0, 0.35) },
  front: { pos: cellToScene(0.0, -1.85, 0.55), target: cellToScene(0.0, 0.0, 0.40) },
  side: { pos: cellToScene(-1.85, 0.05, 0.55), target: cellToScene(0.0, 0.0, 0.40) },
  top: { pos: cellToScene(0.0, -0.02, 2.35), target: cellToScene(0.0, 0.0, 0.0) },
  robot: { pos: cellToScene(0.85, -0.55, 0.72), target: cellToScene(0.20, 0.12, 0.40) },
  board: { pos: cellToScene(-0.55, -0.72, 0.55), target: cellToScene(-0.10, -0.08, 0.04) },
  camera: { pos: cellToScene(LAYOUT.camera.x, LAYOUT.camera.y, LAYOUT.camera.lensZ), target: cellToScene(LAYOUT.camera.x, LAYOUT.camera.y + 0.001, 0.02), fov: 19.2 },
};
window.pcViews = views;

let flight = null;
const homeFov = 34;
function setView(name) {
  const v = views[name]; if (!v) return;
  camera.fov = v.fov || homeFov;
  camera.updateProjectionMatrix();
  flight = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: v.pos.clone(), toT: v.target.clone() };
  document.querySelectorAll(".views button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
}
camera.position.copy(views.iso.pos);
controls.target.copy(views.iso.target);
document.querySelectorAll(".views button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
controls.addEventListener("start", () => {
  flight = null;
  document.querySelectorAll(".views button").forEach((b) => b.setAttribute("aria-pressed", "false"));
});

function applyTheme() {
  const top = new THREE.Color(css("--scene-top") || "#f4f5f6");
  const bottom = new THREE.Color(css("--scene-bottom") || "#d5d8dc");
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#" + top.getHexString());
  gr.addColorStop(1, "#" + bottom.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  floorMat.color.copy(bottom).lerp(top, 0.35);
  scene.environmentIntensity = themeIsDark() ? 0.55 : 0.75;
  drawLanes();
}
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  drawLanes();
}
new ResizeObserver(resize).observe(viewport);
