// Cell dimensions. Values marked [E] are estimated from photos (PLAN §3). Do not change them silently.
const LAYOUT = {
  floor: -0.85,                                   // [E] worktop 0.85 m above the floor
  frame: { x: 1.10, y: 0.75, top: 1.00, prof: 0.040 },  // [E] outer 1100 x 750; roof rails at z = 1.00
  shelf: { z: -0.55 },                            // lower shelf (aluminium slats) [E]
  castor: { d: 0.075, h: 0.10 }, foot: { d: 0.050 },
  worktop: { t: 0.015, slot: 0.040 },             // slotted aluminium plate, T-slots every 40 mm along x
  door: { side: "front", x: [-0.53, 0.53] },      // single hinged door, hinges on the left front post
  robot: { x: 0.20, y: 0.12, yawDeg: 90 },        // WORLD +X along scene +y
  board: { x: -0.10, y: -0.08, yawDeg: 0 },       // Solitaire board centre
  camera: { x: -0.10, y: -0.08, lensZ: 0.876 },   // 856 mm standoff + board top 0.020
  grid: { x: 0.33, y: -0.22 },                    // 200x200 calibration plate, front-right
  controller: { x: -0.30, y: 0.0 },               // open-air R-30iB Mate Plus, lower shelf, left
  eurobox: { x: 0.28, y: 0.0 },                   // grey Euro box with the iPendant, lower shelf, right
};
