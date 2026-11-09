// T0 stub. G1 replaces this file with the SC130EF2 camera, LED ring and calibration grid.
const ledRingMat = null;
function setLed(on) { if (ledRingMat) ledRingMat.emissiveIntensity = on ? 2.2 : 0; }
