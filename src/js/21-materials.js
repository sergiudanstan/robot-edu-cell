const mat = (color, roughness = 0.5, metalness = 0.1, extra = {}) => {
  const physical = (extra.clearcoat > 0) || (extra.transmission > 0) || (extra.sheen > 0);
  const Ctor = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  return new Ctor({ color, roughness, metalness, ...extra });
};
const phys = (color, roughness, metalness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra });

// aluDark, steel and t3Dark are overwritten below with the hi-fi values. lens and glass stay in use.
const M = {
  aluDark: mat(0x9aa1a8, 0.4, 0.7),
  steel: mat(0xd2d6db, 0.22, 0.85),
  t3Dark: mat(0x3b4046, 0.5, 0.2),
  lens: mat(0x111316, 0.2, 0.3),
  boxBody: mat(0x3a1f14, 0.75, 0.05), gold: mat(0xd4a83a, 0.3, 0.85), cavity: mat(0x241209, 0.85, 0.0),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xd8e6ee, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }),
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function procTex(w, h, seed, paint, { color = false, repeat = [1, 1] } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  paint(img.data, w, h, mulberry32(seed));
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}
function put(data, i, r, g, b, a = 255) {
  data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
}

// Roughness maps stay near white so they multiply material.roughness instead of replacing it.
const brushRough = procTex(512, 512, 7, (data, w, h, rnd) => {
  for (let y = 0; y < h; y++) {
    const line = 225 + Math.floor(rnd() * 30);
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, line + Math.floor((rnd() - 0.5) * 28)));
      put(data, (y * w + x) * 4, v, v, v);
    }
  }
}, { repeat: [4, 4] });

const carbonMap = procTex(256, 256, 11, (data, w, h) => {
  const cell = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.floor(x / cell), v = Math.floor(y / cell);
    const twill = ((Math.floor(u / 2) + Math.floor(v / 2)) & 1) === 0;
    const along = (twill ? x : y) % cell;
    const thread = along < cell * 0.72;
    const shade = (thread ? 255 : 205) - ((x * 3 + y) % 12);
    put(data, (y * w + x) * 4, shade, shade, shade);
  }
}, { color: true, repeat: [8, 8] });
const carbonBump = procTex(256, 256, 12, (data, w, h) => {
  const cell = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.floor(x / cell), v = Math.floor(y / cell);
    const twill = ((Math.floor(u / 2) + Math.floor(v / 2)) & 1) === 0;
    const along = (twill ? x : y) % cell;
    const thread = along < cell * 0.72;
    const edge = along === 0 || along === Math.floor(cell * 0.72);
    const shade = edge ? 40 : thread ? 230 : 90;
    put(data, (y * w + x) * 4, shade, shade, shade);
  }
}, { repeat: [8, 8] });

const beltFabric = procTex(256, 256, 21, (data, w, h, rnd) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const warp = (x % 4) < 2;
    const weft = (y % 4) < 2;
    const base = warp === weft ? 236 : 214;
    const v = Math.max(0, Math.min(255, base + Math.floor((rnd() - 0.5) * 12)));
    put(data, (y * w + x) * 4, v, v, v - 1);
  }
}, { color: true, repeat: [6, 2] });

const epoxyMap = procTex(256, 256, 31, (data, w, h, rnd) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = rnd();
    const speck = n > 0.92 ? 40 : n < 0.04 ? -30 : Math.floor((rnd() - 0.5) * 16);
    const v = Math.max(0, Math.min(255, 232 + speck));
    put(data, (y * w + x) * 4, v, v, v);
  }
}, { color: true, repeat: [8, 8] });

const tapeMap = procTex(128, 128, 41, (data, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const stripe = (Math.floor((x + y) / 16) & 1) === 0;
    if (stripe) put(data, (y * w + x) * 4, 240, 196, 0);
    else put(data, (y * w + x) * 4, 18, 18, 18);
  }
}, { color: true, repeat: [2, 2] });

// TubeGeometry: u runs along the path, so rings are vertical stripes.
const ductRings = procTex(128, 32, 51, (data, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const rib = (x % 10) < 2;
    const v = rib ? 245 : 110;
    put(data, (y * w + x) * 4, v, v, v);
  }
}, { repeat: [8, 1] });

const cardboardMap = procTex(256, 256, 61, (data, w, h, rnd) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fiber = Math.sin((x * 0.35 + y * 0.05) + rnd() * 0.4);
    const fleck = rnd() > 0.97 ? -50 : 0;
    const v = Math.max(0, Math.min(255, 226 + fiber * 14 + fleck));
    put(data, (y * w + x) * 4, v, Math.max(0, v - 8), Math.max(0, v - 18));
  }
}, { color: true, repeat: [2, 2] });

const brushed = { roughnessMap: brushRough };
const carbon = { map: carbonMap, bumpMap: carbonBump, bumpScale: 0.35 };
const stainlessBrushed = phys(0xc8c6c2, 0.30, 1, brushed);
const deck = phys(0xc8c6c2, 0.30, 1, { roughnessMap: brushRough });

function floorIsDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

Object.assign(M, {
  aluClear: phys(0xc9ccd0, 0.40, 1),
  aluBlasted: phys(0xbfc3c7, 0.55, 1),
  aluDark: phys(0x1c1d1f, 0.45, 0.4),
  stainlessBrushed,
  steel: phys(0xd2d6db, 0.18, 1),
  chrome: phys(0xeceef0, 0.08, 1),
  zinc9006: phys(0xa5a8a6, 0.5, 0.8),
  galv: phys(0xb4b8bb, 0.45, 0.9),
  blackPlastic: phys(0x151515, 0.65, 0),
  blackRubber: phys(0x151515, 0.85, 0),
  whitePOM: phys(0xf2f1ec, 0.5, 0),
  siliconeBlue: phys(0x2f7fd0, 0.6, 0),
  puBlue: phys(0x2a6fd6, 0.45, 0, { transmission: 0 }),
  pcClear: phys(0xffffff, 0.05, 0, {
    transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2,
  }),
  sealBlack: phys(0x111111, 0.8, 0),
  t3White: phys(0xeef0ef, 0.42, 0, { clearcoat: 0.3, clearcoatRoughness: 0.35 }),
  t3Grey: phys(0xc4c8cc, 0.45, 0),
  t3Dark: phys(0x2e3236, 0.55, 0.1),
  duct: phys(0x3a3d42, 0.6, 0.05, { bumpMap: ductRings, bumpScale: 0.45 }),
  carbonGloss: phys(0x16181b, 0.35, 0.15, { ...carbon, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
  carbonMatte: phys(0x16181b, 0.55, 0.1, carbon),
  motorBlack: phys(0x18191b, 0.5, 0.25),
  gearboxSilver: phys(0xb8bcc0, 0.35, 0.9),
  hoodSteel: stainlessBrushed,
  deck,
  beltPU: phys(0xf4f4f2, 0.8, 0, { map: beltFabric }),
  tunnelWhite: phys(0xe9ecef, 0.35, 0.2),
  coldBlue: phys(0x9fd3f5, 0.4, 0, { emissive: 0x2b6c99, emissiveIntensity: 0.6 }),
  floor: phys(floorIsDark() ? 0x2a2b2c : 0xb9bcbd, 0.55, 0, { map: epoxyMap }),
  tape: phys(0xffffff, 0.6, 0, { map: tapeMap }),
  cabinet: phys(0xc8c6c2, 0.32, 1, { roughnessMap: brushRough }),
  nestPOM: phys(0xf2f1ec, 0.45, 0),
  lampRed: phys(0x5a1010, 0.4, 0, { emissive: 0xff2a2a, emissiveIntensity: 0 }),
  lampAmber: phys(0x5a3a08, 0.4, 0, { emissive: 0xffb020, emissiveIntensity: 0 }),
  lampGreen: phys(0x0d4a1a, 0.4, 0, { emissive: 0x3dff6a, emissiveIntensity: 0 }),
  estopRed: phys(0xc0201a, 0.4, 0),
  estopYellow: phys(0xf2c400, 0.5, 0),
  screen: phys(0x0b0d10, 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 0 }),
  boxBody: phys(0x3a1f14, 0.75, 0.05, { map: cardboardMap }),
  gold: phys(0xd4a83a, 0.3, 0.85),
  cavity: phys(0x241209, 0.85, 0),
});

const FLAVOUR_MAT = {
  dark: phys(0x2e170f, 0.30, 0.05, { clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  milk: phys(0x6e3f24, 0.35, 0.04, { clearcoat: 0.4, clearcoatRoughness: 0.28 }),
  ruby: phys(0xa83a55, 0.35, 0.04, { clearcoat: 0.4, clearcoatRoughness: 0.28 }),
};
const BLOOM_MAT = {
  dark: phys(0x8f8279, 0.9, 0),
  milk: phys(0xa99282, 0.9, 0),
  ruby: phys(0xcfa3ad, 0.9, 0),
};

function applyFloorTheme() {
  M.floor.color.set(floorIsDark() ? 0x2a2b2c : 0xb9bcbd);
}

// FANUC cell. controllerYellow is the open-air cabinet's front cover.
const fanucYellow = phys(0xF5C221, 0.38, 0.04, { clearcoat: 0.4, clearcoatRoughness: 0.22 });
Object.assign(M, {
  fanucYellow,
  fanucBlack: phys(0x161717, 0.5, 0.12),
  fanucFlange: phys(0x262626, 0.45, 0.2),
  nylonBlack: phys(0x1a1a1a, 0.55, 0),
  nylonWhite: phys(0xf4f4f0, 0.45, 0),
  gripperBody: phys(0xd9dbdc, 0.45, 0.04),
  gripperFinger: phys(0x3a3d40, 0.5, 0.08),
  controllerBlack: phys(0x1b1c1e, 0.5, 0.18),
  controllerYellow: fanucYellow,
  euroGrey: phys(0x8a8f94, 0.7, 0.12),
  lowerYellow: phys(0xF2C230, 0.6, 0.04),
  ledRing: phys(0x2a2a2a, 0.35, 0, { emissive: 0xffffff, emissiveIntensity: 0 }),
});
window.addEventListener("themechange", applyFloorTheme);
