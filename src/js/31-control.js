// R-30iB Mate Plus open-air cabinet (left) and the grey Euro box with the iPendant (right).
// Both sit on the shelf slats. Sizes: cabinet 370 × 350 × 200, box 400 × 300 × 220. [plan §7]
const cabShelf = LAYOUT.shelf.z + LAYOUT.frame.prof / 2 + 0.008;
const C = LAYOUT.controller;
const cw = 0.370, cd = 0.350, ch = 0.200;
const cz = cabShelf + ch / 2;
rbox(cw, cd, ch, 0.004, M.controllerBlack, C.x, C.y, cz);
const faceY = C.y - cd / 2;
box(cw - 0.02, 0.008, ch - 0.02, M.controllerFace, C.x, faceY - 0.004, cz);
const fan = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.006, 28), M.controllerBlack);
fan.position.set(C.x - 0.07, faceY - 0.009, cz + 0.01);
const fanRing = mesh(new THREE.TorusGeometry(0.046, 0.004, 8, 24), M.zinc9006);
fanRing.rotation.x = Math.PI / 2;
fanRing.position.copy(fan.position);
vcyl(0.014, 0.008, M.estopYellow, C.x + 0.10, faceY - 0.012, cz + 0.045);
vcyl(0.010, 0.012, M.estopRed, C.x + 0.10, faceY - 0.016, cz + 0.045);
vcyl(0.007, 0.010, M.steel, C.x + 0.055, faceY - 0.012, cz + 0.04);
vcyl(0.008, 0.008, M.lampGreen, C.x + 0.055, faceY - 0.012, cz + 0.005);
box(0.09, 0.004, 0.028, M.aluDark, C.x + 0.10, faceY - 0.010, cz - 0.045);

const E = LAYOUT.eurobox;
const ew = 0.400, ed = 0.300, eh = 0.220;
const ez = cabShelf + eh / 2;
rbox(ew, ed, eh, 0.006, M.euroGrey, E.x, E.y, ez);
box(ew - 0.03, ed - 0.03, 0.012, M.controllerBlack, E.x, E.y, cabShelf + eh - 0.008);

// iPendant hung on the front of the box. [E] 190 × 345 × 80 mm.
const pendZ = cabShelf + 0.155;
const pendY = E.y - ed / 2 - 0.055;
rbox(0.190, 0.080, 0.345, 0.008, M.controllerBlack, E.x, pendY, pendZ);
const screen = labelPlane("iPendant", 0.150, 0.100, {
  bg: "#14181c", fg: "#d5dde4", font: "600 64px 'IBM Plex Sans', sans-serif", px: 220,
});
screen.rotation.x = Math.PI / 2;
screen.position.set(E.x, pendY - 0.041, pendZ + 0.06);
world.add(screen);
box(0.150, 0.004, 0.110, M.aluDark, E.x, pendY - 0.042, pendZ - 0.06);
vcyl(0.012, 0.010, M.estopYellow, E.x + 0.062, pendY - 0.046, pendZ + 0.145);
vcyl(0.008, 0.012, M.estopRed, E.x + 0.062, pendY - 0.050, pendZ + 0.145);
box(0.010, 0.006, 0.07, M.estopYellow, E.x - 0.07, pendY + 0.038, pendZ - 0.02);

// Coiled pendant lead back to the cabinet, and the mains cable out the rear.
const coil = [];
const a = V(E.x - 0.04, pendY, pendZ - 0.16);
const b = V(C.x + 0.12, C.y, cz);
for (let i = 0; i <= 72; i++) {
  const u = i / 72;
  const ang = u * Math.PI * 8;
  coil.push(V(
    a.x + (b.x - a.x) * u + Math.cos(ang) * 0.012,
    a.y + (b.y - a.y) * u,
    a.z + (b.z - a.z) * u + Math.sin(ang) * 0.012,
  ));
}
tubeAlong(coil, 0.0045, M.blackRubber, world, 80, 8);
tubeAlong([
  V(C.x, C.y + cd / 2, cz - 0.02),
  V(C.x, 0.30, cz - 0.04),
  V(C.x, (F.cy || 0) + F.y / 2 + 0.02, -0.25),
  V(C.x + 0.08, (F.cy || 0) + F.y / 2 + 0.08, -0.55),
], 0.008, M.blackRubber, world, 24, 8);
