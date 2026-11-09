function mesh(geo, m, parent = world) { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function box(w, d, h, m, x, y, z, parent) { const o = mesh(new THREE.BoxGeometry(w, d, h), m, parent); o.position.set(x, y, z); return o; }
function vcyl(r, h, m, x, y, z, seg = 32, parent) { const o = mesh(new THREE.CylinderGeometry(r, r, h, seg), m, parent); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; }
const UP = V(0, 1, 0);
function rod(r, m, seg = 12) { return mesh(new THREE.CylinderGeometry(r, r, 1, seg), m); }
function placeRod(o, a, b) { const d = b.clone().sub(a); o.position.copy(a).addScaledVector(d, 0.5); o.scale.set(1, d.length(), 1); o.quaternion.setFromUnitVectors(UP, d.normalize()); }
function stadium(len, r, depth, m, parent) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false); s.absarc(len, 0, r, -Math.PI / 2, Math.PI / 2, false);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
  return mesh(g, m, parent);
}
function stripeTexture(base, stripe, repeat) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 16;
  const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 16); g.fillStyle = stripe; for (let i = 0; i < 256; i += 16) g.fillRect(i, 0, 5, 16);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, 1); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- helpers of the hi-fi build (contract: plan §4.2; signatures are fixed)
// Rounded box: use it for every visible solid (radius 1.5-5 mm), plain box() only for hidden or tiny parts.
function rbox(w, d, h, r, m, x, y, z, parent) {
  const rr = Math.max(1e-5, Math.min(r, Math.min(w, d, h) / 2 - 1e-5));
  const o = mesh(new RoundedBoxGeometry(w, d, h, 4, rr), m, parent); o.position.set(x, y, z); return o;
}
const toShape = (pts) => (pts instanceof THREE.Shape ? pts : new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1]))));
// Move each outline point toward the centroid by `dist` so a later bevelSize brings the outside back to the requested size.
function shrinkOutline(pts, dist) {
  const list = pts instanceof THREE.Shape ? pts.getPoints(48) : pts;
  const xy = list.map((p) => [p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1]]);
  let cx = 0, cy = 0;
  for (const [x, y] of xy) { cx += x; cy += y; }
  cx /= xy.length; cy /= xy.length;
  return xy.map(([x, y]) => {
    const dx = cx - x, dy = cy - y, len = Math.hypot(dx, dy) || 1;
    const t = Math.min(dist, len * 0.85);
    return [x + (dx / len) * t, y + (dy / len) * t];
  });
}
// Extrusion of a closed outline. bevel 0 keeps the T0 path: depth is the full span, no extra translate.
// bevel > 0 shrinks the outline, rounds it back out, and keeps the span exact (bevel adds thickness on both ends).
function extrudeShapeGeo(pts, depthTotal, bevel) {
  const b = Math.max(0, Math.min(bevel || 0, depthTotal / 2 - 1e-4));
  const geo = new THREE.ExtrudeGeometry(toShape(b > 0 ? shrinkOutline(pts, b) : pts), {
    depth: depthTotal - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: 0, bevelSegments: 3, curveSegments: 24,
  });
  if (b > 0) geo.translate(0, 0, b);
  return geo;
}
// Plan outline [[x, y], ...] (or a THREE.Shape) extruded from z0 to z1.
function extrudeXY(pts, z0, z1, m, parent, bevel = 0) { const geo = extrudeShapeGeo(pts, z1 - z0, bevel); geo.translate(0, 0, z0); return mesh(geo, m, parent); }
// Side profile [[x, z], ...] extruded along y from y0 to y1 (rotateX(+90°) maps depth w to -y, then shift by y1; no mirroring).
function extrudeXZ(pts, y0, y1, m, parent, bevel = 0) { const geo = extrudeShapeGeo(pts, y1 - y0, bevel); geo.rotateX(Math.PI / 2); geo.translate(0, y1, 0); return mesh(geo, m, parent); }
// Profile [[r, z], ...] (bottom to top) revolved about the local z axis.
function lathe(prof, m, parent, seg = 48) {
  const geo = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), seg); geo.rotateX(Math.PI / 2); return mesh(geo, m, parent);
}
// Tube through points (Vector3 or [x, y, z]); updateTube() rebuilds it in place (dispose + new geometry).
function tubeGeo(pts, r, tub, rad) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V(p[0], p[1], p[2]))), false, "centripetal");
  return new THREE.TubeGeometry(curve, tub, r, rad, false);
}
function tubeAlong(pts, r, m, parent, tub = 64, rad = 12) { const o = mesh(tubeGeo(pts, r, tub, rad), m, parent); o.userData.tube = { r, tub, rad }; return o; }
function updateTube(o, pts) { const { r, tub, rad } = o.userData.tube; o.geometry.dispose(); o.geometry = tubeGeo(pts, r, tub, rad); }

// 40x40 slot-8 section, metres. One unit-length extrusion, instanced with scale z = length.
function profile4040Shape() {
  const s = 0.001, r = 4;
  const face = [[20, -4], [15.5, -4], [15.5, -8], [9.75, -8], [7.75, -6], [7.75, 6], [9.75, 8], [15.5, 8], [15.5, 4], [20, 4]];
  const shape = new THREE.Shape();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, c = Math.cos(a), si = Math.sin(a);
    const R = ([x, y]) => [(x * c - y * si) * s, (x * si + y * c) * s];
    const [cx, cy] = R([16, -16]);
    if (k === 0) shape.moveTo(...R([16, -20]));
    shape.absarc(cx, cy, r * s, a - Math.PI / 2, a, false);
    for (const p of face) shape.lineTo(...R(p));
    shape.lineTo(...R([20, 16]));
  }
  shape.closePath();
  const hole = (x, y, rad) => { const p = new THREE.Path(); p.absarc(x * s, y * s, rad * s, 0, Math.PI * 2, true); return p; };
  shape.holes.push(hole(0, 0, 3.4), hole(14, 14, 3), hole(-14, 14, 3), hole(-14, -14, 3), hole(14, -14, 3));
  return shape;
}
const PROFILE_CAP = 800;
const BOLT_CAP = 1500;
const profileGeo = new THREE.ExtrudeGeometry(profile4040Shape(), { depth: 1, bevelEnabled: false, curveSegments: 3 });
// ISO 7380 M8 button head: Ø14 mm × 4.4 mm, dome and a small chamfer, revolved about Y.
const boltGeo = new THREE.LatheGeometry([
  new THREE.Vector2(0, 0.0022), new THREE.Vector2(0.0048, 0.0022), new THREE.Vector2(0.0064, 0.0015),
  new THREE.Vector2(0.007, 0.0006), new THREE.Vector2(0.007, -0.0015), new THREE.Vector2(0.0062, -0.0022), new THREE.Vector2(0, -0.0022),
], 20);
function makeInstanced(geo, material, cap, parent) {
  const o = new THREE.InstancedMesh(geo, material, cap);
  o.count = 0;
  o.castShadow = o.receiveShadow = true;
  o.frustumCulled = false;
  o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(o);
  return o;
}
const profiles = makeInstanced(profileGeo, M.aluClear, PROFILE_CAP, world);
const bolts = makeInstanced(boltGeo, M.steel, BOLT_CAP, world);
const extraProfiles = new Map();
const extraBolts = new Map();
function pooledMesh(map, parent, geo, material, cap) {
  let o = map.get(parent);
  if (!o) { o = makeInstanced(geo, material, cap, parent); map.set(parent, o); }
  return o;
}
const _beamQ = new THREE.Quaternion();
const _beamS = new THREE.Vector3();
const _beamM = new THREE.Matrix4();
const _beamD = new THREE.Vector3();
const _zAxis = V(0, 0, 1);
const _boltP = new THREE.Vector3();
const _boltN = new THREE.Vector3();
let profileWarned = false, boltWarned = false;
// 40x40 slot-8 beam from a to b, in the parent's local frame. Ends are bare; cap them at the call site.
// One InstancedMesh per parent so a later rigid move (a robot root) carries its beams.
function profileBeam(a, b, parent = world) {
  const pool = parent === world ? profiles : pooledMesh(extraProfiles, parent, profileGeo, M.aluClear, PROFILE_CAP);
  _beamD.subVectors(b, a);
  const L = _beamD.length();
  if (L < 1e-6) return pool;
  if (pool.count >= PROFILE_CAP) { if (!profileWarned) { profileWarned = true; console.warn("profileBeam: capacity", PROFILE_CAP); } return pool; }
  _beamD.multiplyScalar(1 / L);
  _beamQ.setFromUnitVectors(_zAxis, _beamD);
  _beamS.set(1, 1, L);
  _beamM.compose(a, _beamQ, _beamS);
  pool.setMatrixAt(pool.count, _beamM);
  pool.count += 1;
  return pool;
}
let profilesFinal = false;
function finalizeProfiles() {
  if (profilesFinal) return;
  profilesFinal = true;
  profiles.instanceMatrix.needsUpdate = true;
  bolts.instanceMatrix.needsUpdate = true;
  extraProfiles.forEach((o) => { o.instanceMatrix.needsUpdate = true; });
  extraBolts.forEach((o) => { o.instanceMatrix.needsUpdate = true; });
}
// ISO 7380 M8 button head seated on the face. `normal` points out of the face. The head centre sits 2.2 mm out.
function addBolt(pos, normal, parent = world) {
  const pool = parent === world ? bolts : pooledMesh(extraBolts, parent, boltGeo, M.steel, BOLT_CAP);
  if (pool.count >= BOLT_CAP) { if (!boltWarned) { boltWarned = true; console.warn("addBolt: capacity", BOLT_CAP); } return pool; }
  _boltN.copy(normal);
  if (_boltN.lengthSq() < 1e-12) _boltN.copy(_zAxis); else _boltN.normalize();
  _beamQ.setFromUnitVectors(UP, _boltN);
  _boltP.copy(pos).addScaledVector(_boltN, 0.0022);
  _beamS.set(1, 1, 1);
  _beamM.compose(_boltP, _beamQ, _beamS);
  pool.setMatrixAt(pool.count, _beamM);
  pool.count += 1;
  return pool;
}
// Sticker / tag: a plane facing +z with centred text. Not added to the scene; the caller places and rotates it.
function labelPlane(text, w, h, opts = {}) {
  const { bg = "#ffffff", fg = "#111111", font = "600 140px 'IBM Plex Sans', sans-serif", px = 256 } = opts;
  const c = document.createElement("canvas"); c.height = px; c.width = Math.max(px, Math.round(px * w / h));
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 0.07;
  for (let i = 0; i < 500; i++) {
    const v = Math.floor(Math.random() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 1);
  }
  g.globalAlpha = 1;
  g.fillStyle = fg; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
  o.receiveShadow = true;
  return o;
}
