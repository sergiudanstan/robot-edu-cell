// T0 shell. G2 fills the cards. The transport and the view buttons already work.
let mode = "program";
const LANES = [
  ["robot", "--lane-robot"],
  ["gripper", "--lane-grip"],
  ["vision", "--lane-vision"],
  ["io", "--lane-io"],
];

function setMode(m) {
  mode = m;
  document.querySelectorAll(".mode-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  if (m === "manual") setPlaying(false);
}
document.querySelectorAll(".mode-switch button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

const drawer = $("drawer");
function syncPanels() {
  const open = document.querySelector(".rail-item[aria-pressed='true']");
  if (drawer) drawer.hidden = !open;
}
document.querySelectorAll(".rail-item").forEach((b) => b.addEventListener("click", () => {
  const was = b.getAttribute("aria-pressed") === "true";
  document.querySelectorAll(".rail-item").forEach((x) => x.setAttribute("aria-pressed", "false"));
  document.querySelectorAll(".card[data-panel]").forEach((c) => { c.hidden = true; });
  if (!was) {
    b.setAttribute("aria-pressed", "true");
    const card = document.querySelector(`.card[data-panel="${b.dataset.panel}"]`);
    if (card) card.hidden = false;
  }
  syncPanels();
}));

const guardsBox = $("guards");
if (guardsBox) guardsBox.addEventListener("change", (e) => { guardPanels.visible = e.target.checked; });

const laneCanvas = $("lanes");
function drawLanes() {
  if (!laneCanvas) return;
  const w = laneCanvas.clientWidth, h = laneCanvas.clientHeight;
  if (w < 2 || h < 2) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  laneCanvas.width = Math.floor(w * dpr);
  laneCanvas.height = Math.floor(h * dpr);
  const g = laneCanvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const rowH = h / LANES.length;
  LANES.forEach(([name, varName], i) => {
    const y = i * rowH + 2;
    const hh = rowH - 4;
    const col = css(varName) || "#888";
    for (const s of segs[name] || []) {
      const x0 = (s.t0 / DURATION) * w;
      const x1 = (s.t1 / DURATION) * w;
      g.fillStyle = col;
      g.globalAlpha = 0.85;
      g.fillRect(x0, y, Math.max(1, x1 - x0), hh);
    }
  });
  g.globalAlpha = 1;
}

function renderGantt() {}
