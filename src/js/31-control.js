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
const euroBox = new THREE.Group();
euroBox.name = "euro-storage-box";
euroBox.position.set(E.x, E.y, cabShelf);
world.add(euroBox);
// Open grey tote: thin walls, stacking rims, moulded ribs and recessed carry handles.
box(ew - 0.012, ed - 0.012, 0.012, M.euroGrey, 0, 0, 0.006, euroBox);
for (const side of [-1, 1]) {
  rbox(ew - 0.012, 0.008, eh - 0.012, 0.003, M.euroGrey, 0, side * (ed / 2 - 0.010), eh / 2, euroBox);
  rbox(0.008, ed - 0.028, eh - 0.012, 0.003, M.euroGrey, side * (ew / 2 - 0.010), 0, eh / 2, euroBox);
  for (const z of [0.022, eh - 0.010]) {
    rbox(ew, 0.014, 0.016, 0.003, M.euroGrey, 0, side * (ed / 2 - 0.007), z, euroBox);
    rbox(0.014, ed - 0.028, 0.016, 0.003, M.euroGrey, side * (ew / 2 - 0.007), 0, z, euroBox);
  }
  for (const x of [-0.170, -0.110, -0.050, 0.050, 0.110, 0.170])
    rbox(0.008, 0.006, 0.155, 0.002, M.euroGrey, x, side * (ed / 2 - 0.003), 0.110, euroBox);
  for (const y of [-0.110, -0.065, 0.065, 0.110])
    rbox(0.006, 0.008, 0.155, 0.002, M.euroGrey, side * (ew / 2 - 0.003), y, 0.110, euroBox);
  rbox(0.002, 0.095, 0.027, 0.004, M.aluDark, side * (ew / 2 - 0.005), 0, 0.177, euroBox);
  rbox(0.010, 0.110, 0.012, 0.003, M.euroGrey, side * (ew / 2 - 0.005), 0, 0.194, euroBox);
}

// Handheld silhouette from robot_spec §4 / manual_p012_ipendant.png.
// Estimated outer size 190 W × 345 H × 80 D mm, including the rear grips.
const pendZ = cabShelf + 0.185;
const pendY = E.y - ed / 2 - 0.065;
const pendant = new THREE.Group();
pendant.name = "ipendant-handheld";
pendant.position.set(E.x, pendY, pendZ);
world.add(pendant);
const pendantShell = extrudeXZ([
  [-0.060,-0.1725], [0.060,-0.1725], [0.072,-0.155], [0.074,-0.045],
  [0.095,-0.020], [0.095,0.135], [0.082,0.1725], [0.055,0.1725],
  [0.042,0.148], [-0.042,0.148], [-0.055,0.1725], [-0.082,0.1725],
  [-0.095,0.135], [-0.095,-0.020], [-0.074,-0.045], [-0.072,-0.155],
], -0.040, 0.010, M.t3Dark, pendant, 0.004);
pendantShell.name = "pendant-shell";
// Rear grips leave a finger gap; the yellow deadman strips face the back.
for (const x of [-0.065, 0.065]) {
  for (const z of [-0.125, -0.020])
    rbox(0.018, 0.025, 0.014, 0.004, M.t3Dark, x, 0.021, z, pendant);
  rbox(0.022, 0.018, 0.120, 0.006, M.blackRubber, x, 0.029, -0.0725, pendant);
  rbox(0.012, 0.004, 0.086, 0.002, M.estopYellow, x, 0.038, -0.0725, pendant);
}
// Raised bracket on the tote rim, with a hook engaging a rear hanging loop.
rbox(0.024, 0.008, 0.140, 0.003, M.steel, E.x, E.y - ed / 2 - 0.007, cabShelf + 0.274);
tubeAlong([
  V(E.x, E.y - ed / 2 - 0.007, cabShelf + 0.334),
  V(E.x, pendY + 0.023, cabShelf + 0.334),
  V(E.x, pendY + 0.023, cabShelf + 0.322),
  V(E.x, pendY + 0.030, cabShelf + 0.319),
  V(E.x, pendY + 0.034, cabShelf + 0.328),
], 0.004, M.steel, world, 32, 8);
const pendantLoop = mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 24), M.blackRubber, pendant);
pendantLoop.rotation.x = Math.PI / 2;
pendantLoop.position.set(0, 0.022, 0.140);
// Front faces -y; labels are in the x/z plane. No decorative branding.
function pendantLabel(text, w, h, x, z, opts = {}) {
  const label = labelPlane(text, w, h, { bg: "#101b22", fg: "#b8cbd0", font: "500 26px monospace", px: 48, ...opts });
  label.rotation.x = Math.PI / 2;
  label.position.set(x, -0.047, z);
  pendant.add(label);
  return label;
}
rbox(0.145, 0.006, 0.112, 0.004, M.blackRubber, 0, -0.041, 0.060, pendant);
pendantLabel("", 0.130, 0.098, 0, 0.060);
const tpScreen = ["SELECT  CELL_PICK  T1", "PAUSED        10%", "1: UFRAME_NUM=1", "2: UTOOL_NUM=1", "3:J P[1] 10% FINE", "4:L P[2] 100mm/s FINE", "5: RO[1]=ON"];
tpScreen.forEach((line, i) => {
  const label = pendantLabel(line, 0.125, 0.010, 0, 0.101 - i * 0.013, { font: "500 22px monospace", px: 32 });
  label.position.y = -0.0472;
});
// Keypad: function keys, blue SHIFT/jog keys and white numeric legends.
rbox(0.128, 0.004, 0.146, 0.003, M.gripperBody, 0, -0.041, -0.079, pendant);
for (let i = 0; i < 5; i++)
  pendantLabel(`F${i + 1}`, 0.020, 0.011, -0.048 + i * 0.024, -0.015, { bg: "#c5c7c8", fg: "#16181b" });
const keyRows = [["SHIFT","MENU","EDIT","SHIFT"], ["7","8","9","-J1 +J1"], ["4","5","6","-J2 +J2"], ["1","2","3","-J3 +J3"], ["0",".","ENT","-J4 +J4"], ["HOLD","STEP","FWD","-J5 +J5"], ["RESET","BWD","COORD","-J6 +J6"]];
keyRows.forEach((row, r) => row.forEach((key, c) => {
  const blue = c === 3 || key === "SHIFT";
  pendantLabel(key, c === 3 ? 0.039 : 0.022, 0.013, [-0.049,-0.022,0.005,0.040][c], -0.035 - r * 0.018,
    { bg: blue ? "#164c94" : "#e0e0da", fg: blue ? "#e0e9f4" : "#202328", font: "600 23px monospace" });
}));
// Cylinders along y point out of the front, unlike vertical vcyl().
function pendantButton(r, depth, mat, x, y, z) {
  const button = mesh(new THREE.CylinderGeometry(r, r, depth, 32), mat, pendant);
  button.position.set(x, y, z);
  return button;
}
pendantButton(0.024, 0.010, M.blackRubber, 0.066, -0.043, 0.141);
pendantButton(0.019, 0.006, M.estopYellow, 0.066, -0.051, 0.141);
pendantButton(0.015, 0.014, M.estopRed, 0.066, -0.060, 0.145);
pendantButton(0.017, 0.006, M.blackRubber, -0.066, -0.044, 0.141);
pendantButton(0.010, 0.004, M.steel, -0.066, -0.049, 0.141);
const pendantKey = rbox(0.006, 0.012, 0.022, 0.002, M.controllerBlack, -0.066, -0.056, 0.141, pendant);
pendantKey.rotation.y = -0.45;

// Black lead enters at the lower left, sags in front of the shelf, then coils to the controller.
const a = V(E.x - 0.066, pendY, pendZ - 0.154);
const coilStart = V(E.x - 0.095, pendY - 0.020, cabShelf + 0.014);
const b = V(C.x + 0.12, faceY - 0.025, cz - 0.055);
tubeAlong([a, V(a.x - 0.025, a.y - 0.008, a.z - 0.008), coilStart], 0.004, M.blackRubber, world, 24, 8);
const coil = [];
for (let i = 0; i <= 360; i++) {
  const u = i / 360, angle = u * Math.PI * 36;
  const radius = 0.009 * Math.sin(Math.PI / 2 * Math.min(1, u * 8, (1 - u) * 8));
  coil.push(V(
    coilStart.x + (b.x - coilStart.x) * u,
    coilStart.y + (b.y - coilStart.y) * u + Math.cos(angle) * radius,
    coilStart.z + (b.z - coilStart.z) * u + Math.sin(angle) * radius,
  ));
}
tubeAlong(coil, 0.003, M.blackRubber, world, 720, 8);
tubeAlong([
  V(C.x, C.y + cd / 2, cz - 0.02),
  V(C.x, 0.30, cz - 0.04),
  V(C.x, (F.cy || 0) + F.y / 2 + 0.02, -0.25),
  V(C.x + 0.08, (F.cy || 0) + F.y / 2 + 0.08, -0.55),
], 0.008, M.blackRubber, world, 24, 8);
