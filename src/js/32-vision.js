// iRVision SC130EF2 above the board. Lens front at LAYOUT.camera.lensZ, looking down.
// Standoff 856 mm over the board top, so the view is about 362 × 290 mm. Grid plate stored front-right.
const cam = LAYOUT.camera;
const lensFront = cam.lensZ;
const bodyZ = lensFront + 0.035 + 0.030;
box(0.046, 0.046, 0.060, M.controllerBlack, cam.x, cam.y, bodyZ);
vcyl(0.015, 0.035, M.fanucBlack, cam.x, cam.y, lensFront + 0.0175);
const led = mesh(new THREE.TorusGeometry(0.020, 0.0032, 10, 28), M.ledRing);
led.position.set(cam.x, cam.y, lensFront + 0.001);
const ledRingMat = M.ledRing;
function setLed(on) {
  ledRingMat.emissiveIntensity = on ? 3.2 : 0;
  ledRingMat.color.setHex(on ? 0xffffff : 0x2a2a2a);
}

// Drop from a roof beam that crosses above the camera.
const roofZ = LAYOUT.frame.top;
const y0 = (LAYOUT.frame.cy || 0) - LAYOUT.frame.y / 2 + LAYOUT.frame.prof;
const y1 = (LAYOUT.frame.cy || 0) + LAYOUT.frame.y / 2 - LAYOUT.frame.prof;
profileBeam(V(cam.x, y0, roofZ), V(cam.x, y1, roofZ));
profileBeam(V(cam.x, cam.y, bodyZ + 0.030), V(cam.x, cam.y, roofZ));

// 200 × 200 × 3 mm plate, 11 × 11 dots at 15 mm. Stored flat on the worktop.
const gridCanvas = document.createElement("canvas");
gridCanvas.width = 512; gridCanvas.height = 512;
{
  const g = gridCanvas.getContext("2d");
  g.fillStyle = "#f3f3f0";
  g.fillRect(0, 0, 512, 512);
  const margin = 512 * (25 / 200);
  const pitch = 512 * (15 / 200);
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
    const onX = i === 5 && (j === 5 || j === 7 || j === 9);
    const onY = j === 5 && i === 7;
    const big = onX || onY;
    g.fillStyle = "#161616";
    g.beginPath();
    g.arc(margin + j * pitch, margin + (10 - i) * pitch, big ? 8 : 4.4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#222";
  g.font = "600 22px sans-serif";
  g.fillText("CALIBRATION", 16, 26);
  g.font = "500 15px sans-serif";
  g.fillText("(15mm CENTER TO CENTER)", 168, 500);
}
const gridTex = new THREE.CanvasTexture(gridCanvas);
gridTex.colorSpace = THREE.SRGBColorSpace;
gridTex.anisotropy = 8;
const gridMat = M.aluBlasted.clone();
gridMat.map = gridTex;
gridMat.roughness = 0.55;
gridMat.metalness = 0.15;
const plate = mesh(new THREE.BoxGeometry(0.200, 0.200, 0.003), gridMat);
plate.position.set(LAYOUT.grid.x, LAYOUT.grid.y, 0.0015);
const G = LAYOUT.grid;
box(0.012, 0.004, 0.004, M.blackPlastic, G.x, G.y - 0.09, 0.004);
