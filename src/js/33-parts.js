// Solitaire board and the ten cylinders. Hole positions come from the logic (HOLES / BOARD).
const boardShape = new THREE.Shape();
boardShape.moveTo(-BOARD.w / 2, -BOARD.d / 2);
boardShape.lineTo(BOARD.w / 2, -BOARD.d / 2);
boardShape.lineTo(BOARD.w / 2, BOARD.d / 2);
boardShape.lineTo(-BOARD.w / 2, BOARD.d / 2);
boardShape.closePath();
for (const h of HOLES) {
  const path = new THREE.Path();
  path.absarc(h.lx, h.ly, BOARD.holeR, 0, Math.PI * 2, true);
  boardShape.holes.push(path);
}
const boardTop = extrudeXY(boardShape, BOARD.h - BOARD.holeD, BOARD.h, M.nylonBlack);
boardTop.position.set(BOARD.x, BOARD.y, 0);
box(BOARD.w, BOARD.d, BOARD.h - BOARD.holeD, M.nylonBlack, BOARD.x, BOARD.y, (BOARD.h - BOARD.holeD) / 2);

const cylH = BOARD.cylH, cylR = BOARD.cylR, chm = BOARD.chamfer;
const cylProfile = [
  [0, -cylH / 2], [cylR - chm, -cylH / 2], [cylR, -cylH / 2 + chm],
  [cylR, cylH / 2 - chm], [cylR - chm, cylH / 2], [0, cylH / 2],
];
const cylGeo = lathe(cylProfile, M.nylonWhite, world, 28).geometry;
const partMeshes = [];
function buildPartMeshes() {
  const src = parts.length ? parts : HOLES.filter((h) => h.side === "A");
  for (const p of src) {
    const o = mesh(cylGeo, M.nylonWhite);
    const home = p.track ? p.track[0].p : [p.x, p.y, p.cz];
    o.position.set(home[0], home[1], home[2]);
    partMeshes.push(o);
  }
}
buildPartMeshes();
// The lathe helper already added one mesh; that one is the geometry donor and stays hidden.
cylGeo.userData = {};
world.children.forEach((o) => {
  if (o.geometry === cylGeo && !partMeshes.includes(o)) o.visible = false;
});

function placeParts(t) {
  for (let n = 0; n < partMeshes.length; n++) {
    const p = parts[n];
    const g = partMeshes[n];
    if (!p || !p.track || !p.track.length) continue;
    let kf = p.track[0];
    let nxt = null;
    for (const k of p.track) {
      if (k.t <= t + 1e-9) kf = k;
      else if (!nxt) nxt = k;
    }
    if (nxt && nxt.t > kf.t) {
      const u = (t - kf.t) / (nxt.t - kf.t);
      g.position.set(
        kf.p[0] + (nxt.p[0] - kf.p[0]) * u,
        kf.p[1] + (nxt.p[1] - kf.p[1]) * u,
        kf.p[2] + (nxt.p[2] - kf.p[2]) * u,
      );
    } else g.position.set(kf.p[0], kf.p[1], kf.p[2]);
  }
}
