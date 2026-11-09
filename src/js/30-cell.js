// Silver educational cell. Post centres: x = ±0.530, y = cy ± 0.450.
// With cy = 0.09 and depth 0.94 the outer envelope is y −0.38 … 0.56.
// Rail centre-lines: base −0.80, shelf −0.55, worktop 0, roof 1.00. Posts run −0.82 … 1.02.
const F = LAYOUT.frame;
const P = F.prof;
const hx = F.x / 2 - P / 2;
const cy = F.cy || 0;
const hy = F.y / 2 - P / 2;
const yFront = cy - hy;
const yBack = cy + hy;
const levels = [-0.80, LAYOUT.shelf.z, 0, F.top];
const postZ0 = levels[0] - P / 2;
const postZ1 = F.top + P / 2;
const posts = [[-hx, yFront], [hx, yFront], [hx, yBack], [-hx, yBack]];

const floorMat = M.floor;
const floor = mesh(new THREE.PlaneGeometry(8, 8), floorMat);
floor.position.z = LAYOUT.floor;
floor.castShadow = false;
floor.receiveShadow = true;

for (const [x, y] of posts) profileBeam(V(x, y, postZ0), V(x, y, postZ1));
for (const z of levels) {
  profileBeam(V(-hx + P / 2, yFront, z), V(hx - P / 2, yFront, z));
  profileBeam(V(-hx + P / 2, yBack, z), V(hx - P / 2, yBack, z));
  profileBeam(V(-hx, yFront + P / 2, z), V(-hx, yBack - P / 2, z));
  profileBeam(V(hx, yFront + P / 2, z), V(hx, yBack - P / 2, z));
}

const guardPanels = [];
Object.defineProperty(guardPanels, "visible", {
  get() { return guardPanels.length === 0 || guardPanels.every((o) => o.visible); },
  set(v) { for (const o of guardPanels) o.visible = v; },
});
const panelMat = M.pcClear.clone();
panelMat.opacity = 0.16;
panelMat.color.set(0xe7eef1);
function panel(sx, sy, sz, x, y, z, parent = world) {
  const o = box(sx, sy, sz, panelMat, x, y, z, parent);
  o.castShadow = false;
  guardPanels.push(o);
  return o;
}

const inX = hx - P / 2;
const inY0 = yFront + P / 2;
const inY1 = yBack - P / 2;
const inYc = (inY0 + inY1) / 2;
const inYl = inY1 - inY0;
const zPanel0 = P / 2;
const zPanel1 = F.top - P / 2;
panel(0.004, inYl, zPanel1 - zPanel0, -hx + P / 2 - 0.002, inYc, (zPanel0 + zPanel1) / 2);
panel(0.004, inYl, zPanel1 - zPanel0, hx - P / 2 + 0.002, inYc, (zPanel0 + zPanel1) / 2);
panel(inX * 2, 0.004, zPanel1 - zPanel0, 0, yBack - P / 2 + 0.002, (zPanel0 + zPanel1) / 2);
panel(inX * 2 - 0.004, inYl - 0.004, 0.004, 0, inYc, F.top - P / 2 - 0.002);

// Single front door. Hinges on the left post, safety switch on the right post.
const door = new THREE.Group();
world.add(door);
const dz0 = zPanel0 + P / 2;
const dz1 = zPanel1 - P / 2;
const dx0 = -inX + P / 2;
const dx1 = inX - P / 2;
door.position.set(0, yFront, 0);
profileBeam(V(dx0, 0, dz0), V(dx0, 0, dz1), door);
profileBeam(V(dx1, 0, dz0), V(dx1, 0, dz1), door);
profileBeam(V(dx0, 0, dz1), V(dx1, 0, dz1), door);
profileBeam(V(dx0, 0, dz0), V(dx1, 0, dz0), door);
panel(dx1 - dx0 - P, 0.004, dz1 - dz0 - P, (dx0 + dx1) / 2, -0.002, (dz0 + dz1) / 2, door);
for (const z of [0.28, 0.78]) {
  const hinge = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 16), M.blackPlastic, door);
  hinge.rotation.x = Math.PI / 2;
  hinge.position.set(-hx + 0.004, 0.012, z);
}
const handle = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 16), M.blackPlastic, door);
handle.rotation.x = Math.PI / 2;
handle.position.set(dx1 - 0.012, -0.018, 0.48);
const sw = rbox(0.036, 0.028, 0.055, 0.003, M.estopYellow, hx - 0.006, yFront - 0.01, 0.42);
box(0.008, 0.012, 0.012, M.blackPlastic, hx - 0.028, yFront - 0.012, 0.42);

// Lower bay skins: sides and back only, so the controller stays visible from the front.
function skin(sx, sy, sz, x, y, z) {
  const o = box(sx, sy, sz, M.lowerYellow, x, y, z);
  o.castShadow = false;
  return o;
}
const skinZ0 = -0.78, skinZ1 = -0.04;
skin(0.004, F.y - 0.02, skinZ1 - skinZ0, -F.x / 2 - 0.002, cy, (skinZ0 + skinZ1) / 2);
skin(0.004, F.y - 0.02, skinZ1 - skinZ0, F.x / 2 + 0.002, cy, (skinZ0 + skinZ1) / 2);
skin(F.x - 0.02, 0.004, skinZ1 - skinZ0, 0, cy + F.y / 2 + 0.002, (skinZ0 + skinZ1) / 2);

// Shelf slats. Top face is shelfTop; the controller and the Euro box sit on it.
const shelfTop = LAYOUT.shelf.z + P / 2 + 0.008;
for (let y = inY0 + 0.03; y <= inY1 - 0.03; y += 0.04) {
  box(inX * 2 - 0.01, 0.016, 0.008, M.aluBlasted, 0, y, shelfTop - 0.004);
}

// Worktop: 15 mm plate, T-slots every 40 mm along x. Top face at z = 0.
(function worktop() {
  const x0 = -inX, x1 = inX, z0 = -LAYOUT.worktop.t, z1 = 0;
  const gap = 0.008, deep = 0.005;
  const centres = [];
  for (let x = x0 + LAYOUT.worktop.slot / 2; x < x1 - 0.012; x += LAYOUT.worktop.slot) centres.push(x);
  const pts = [[x0, z0], [x1, z0], [x1, z1]];
  for (const cx of centres.reverse()) {
    const a = cx + gap / 2, b = cx - gap / 2;
    pts.push([a, z1], [a, z1 - deep], [b, z1 - deep], [b, z1]);
  }
  pts.push([x0, z1]);
  extrudeXZ(pts, inY0, inY1, M.aluBlasted);
})();

// Castors under the posts, feet just inboard, push handle on the left.
posts.forEach(([x, y], i) => {
  const wx = x + (x > 0 ? 0.01 : -0.01);
  const wy = y + (y > 0 ? 0.01 : -0.01);
  const wheel = mesh(new THREE.CylinderGeometry(LAYOUT.castor.d / 2, LAYOUT.castor.d / 2, 0.018, 20), M.blackRubber);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(wx, wy, LAYOUT.floor + LAYOUT.castor.d / 2);
  const fork = box(0.012, 0.028, 0.04, M.zinc9006, wx, wy, LAYOUT.floor + LAYOUT.castor.d + 0.01);
  const brake = box(0.016, 0.01, 0.008, M.estopRed, wx, wy + (y > 0 ? -0.02 : 0.02), LAYOUT.floor + 0.02);
  const fx = x + (x > 0 ? -0.055 : 0.055);
  const fy = y + (y > 0 ? -0.055 : 0.055);
  vcyl(0.006, 0.055, M.steel, fx, fy, LAYOUT.floor + 0.032);
  vcyl(LAYOUT.foot.d / 2, 0.008, M.blackRubber, fx, fy, LAYOUT.floor + 0.004);
  addBolt(V(x, y, postZ1 + 0.001), V(0, 0, 1));
  if (i === 0) { fork.visible = brake.visible; }
});
tubeAlong([
  V(-hx - 0.012, -0.12, 0.02), V(-hx - 0.07, -0.12, 0.08),
  V(-hx - 0.07, 0.12, 0.08), V(-hx - 0.012, 0.12, 0.02),
], 0.012, M.blackRubber, world, 28, 10);

// Yellow FANUC plate on the front-left roof beam.
const badge = rbox(0.150, 0.006, 0.042, 0.002, M.fanucYellow, -0.30, yFront - P / 2 - 0.004, F.top);
const badgeText = labelPlane("FANUC", 0.132, 0.032, {
  bg: "#F5C221", fg: "#1a1c1e", font: "700 108px 'Barlow Semi Condensed', sans-serif", px: 180,
});
badgeText.rotation.x = Math.PI / 2;
badgeText.position.set(-0.30, yFront - P / 2 - 0.008, F.top);
world.add(badgeText);
void badge;
void sw;
