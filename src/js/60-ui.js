// Panels, TP listing, I/O lamps, jog. Transport and view buttons stay in 70 / 50.
let mode = "program";
let jogQ = null;
let jogGrip = 0;
const LANES = [
  ["robot", "--lane-robot"],
  ["gripper", "--lane-grip"],
  ["vision", "--lane-vision"],
  ["io", "--lane-io"],
];
const JNAMES = ["J1", "J2", "J3", "J4", "J5", "J6"];
const JLIM = [[-170, 170], [-110, 120], [-180, 180], [-190, 190], [-120, 120], [-360, 360]];
const IO_NAMES = [
  ["DI", "1:DOOR_OK", "DI[1:DOOR_OK]"],
  ["DO", "11:BUSY", "DO[11:BUSY]"],
  ["DO", "12:CYCLE_DONE", "DO[12:CYCLE_DONE]"],
  ["RI", "1:CLOSED", "RI[1:CLOSED]"],
  ["RI", "2:OPENED", "RI[2:OPENED]"],
  ["RO", "1:CLOSE", "RO[1:CLOSE]"],
  ["RO", "2:OPEN", "RO[2:OPEN]"],
];

function setMode(m) {
  mode = m;
  document.querySelectorAll(".mode-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  if (m === "manual") {
    setPlaying(false);
    const pose = robotPose(time);
    jogQ = pose.q.slice();
    jogGrip = pose.grip;
    syncJog();
  }
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
      if (s.active === false) continue;
      const x0 = (s.t0 / DURATION) * w;
      const x1 = (s.t1 / DURATION) * w;
      g.fillStyle = col;
      g.globalAlpha = 0.9;
      g.fillRect(x0, y, Math.max(1, x1 - x0), hh);
    }
  });
  g.globalAlpha = 1;
}

function renderGantt() {}

function fmt(v, n) { return Number(v).toFixed(n); }
function wprOf(R) {
  const p = Math.atan2(-R[2][0], Math.hypot(R[0][0], R[1][0]));
  const w = Math.atan2(R[2][1], R[2][2]);
  const r = Math.atan2(R[1][0], R[0][0]);
  return [w, p, r].map((v) => v * 180 / Math.PI);
}
function uf1Of(tcp, R) {
  const p = tcp.map((v, i) => (v - UF1.p[i]) * 1000);
  const A = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  const Ru = [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[0][i] * R[0][j] + A[1][i] * R[1][j] + A[2][i] * R[2][j]));
  return { p, wpr: wprOf(Ru) };
}
function clearanceNow(t) {
  let i = 0;
  while (i < S.t.length - 1 && S.t[i + 1] <= t + 1e-9) i += 1;
  return Math.min(...S.cl[i]);
}

const tpBox = $("tp");
TP.forEach((text, i) => {
  const line = i + 1;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.line = String(line);
  const num = document.createElement("span");
  num.textContent = String(line);
  btn.append(num, document.createTextNode(text.replace(/^\d+:\s*/, "")));
  btn.addEventListener("click", () => {
    if (mode !== "program") setMode("program");
    const hit = program.find((a) => a.line === line);
    if (hit) seek(hit.t0);
  });
  tpBox.append(btn);
});

const lampNodes = {};
const lamps = $("lamps");
for (const [group, key, label] of IO_NAMES) {
  const row = document.createElement("div");
  row.className = "lamp";
  const dot = document.createElement("i");
  row.append(dot, document.createTextNode(label));
  lamps.append(row);
  lampNodes[group + key] = row;
}

const jointRead = [];
const joints = $("joints");
JNAMES.forEach((name, i) => {
  const row = document.createElement("div");
  row.className = "jrow";
  const lab = document.createElement("span");
  lab.textContent = name;
  const bar = document.createElement("div");
  bar.className = "jbar";
  const mark = document.createElement("b");
  bar.append(mark);
  const val = document.createElement("span");
  val.className = "mono";
  row.append(lab, bar, val);
  joints.append(row);
  jointRead.push({ mark, val, lo: JLIM[i][0], hi: JLIM[i][1] });
});

const tcpBox = $("tcp");
function tcpBlock(title) {
  const h = document.createElement("h2");
  h.textContent = title;
  const dl = document.createElement("dl");
  dl.className = "kv";
  const nodes = {};
  for (const k of ["X", "Y", "Z", "W", "P", "R"]) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.className = "mono";
    dl.append(dt, dd);
    nodes[k] = dd;
  }
  tcpBox.append(h, dl);
  return nodes;
}
const tcpUF0 = tcpBlock("UF0");
const tcpUF1 = tcpBlock("UF1");

const report = $("report");
const reportNodes = {};
for (const k of ["Cycle", "Minimum", "Where", "Path", "Peak J"]) {
  const dt = document.createElement("dt");
  dt.textContent = k;
  const dd = document.createElement("dd");
  dd.className = "mono";
  report.append(dt, dd);
  reportNodes[k] = dd;
}
let pathLen = 0;
for (let i = 1; i < S.tcp.length; i++) pathLen += Math.hypot(...S.tcp[i].map((v, k) => v - S.tcp[i - 1][k]));
reportNodes.Cycle.textContent = DURATION.toFixed(2) + " s";
reportNodes.Minimum.textContent = (minClear.m * 1000).toFixed(1) + " mm";
reportNodes.Where.textContent = minClear.link + " / " + minClear.obstacle;
reportNodes.Path.textContent = pathLen.toFixed(2) + " m";
reportNodes["Peak J"].textContent = peakV.map((v) => v.toFixed(0)).join(" ");

$("csv").addEventListener("click", () => {
  const head = "t_s,J1,J2,J3,J4,J5,J6,x_m,y_m,z_m,grip,line";
  const rows = S.t.map((t, i) => [t.toFixed(4), ...S.q[i].map((v) => v.toFixed(3)), ...S.tcp[i].map((v) => v.toFixed(5)), S.grip[i].toFixed(3), S.line[i]].join(","));
  const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fanuc_edu_cell_cycle.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

const jogSliders = [];
const jogBox = $("jog-joints");
JNAMES.forEach((name, i) => {
  const row = document.createElement("label");
  row.className = "jogrow";
  const lab = document.createElement("span");
  lab.textContent = name;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(JLIM[i][0]);
  input.max = String(JLIM[i][1]);
  input.step = "0.5";
  const val = document.createElement("span");
  val.className = "mono";
  row.append(lab, input, val);
  jogBox.append(row);
  input.addEventListener("input", () => {
    ensureJog();
    const q = jogQ.slice();
    let v = Number(input.value);
    if (i === 1 || i === 2) {
      const lo = -69, hi = 205;
      v = i === 1 ? Math.max(lo - q[2], Math.min(hi - q[2], v)) : Math.max(lo - q[1], Math.min(hi - q[1], v));
      v = Math.max(JLIM[i][0], Math.min(JLIM[i][1], v));
    }
    q[i] = v;
    if (!inLimits(q)) { $("jog-note").textContent = "Outside joint limits."; return; }
    jogQ = q;
    $("jog-note").textContent = "Joint jog.";
    syncJog();
  });
  jogSliders.push({ input, val });
});

function ensureJog() {
  if (mode !== "manual") setMode("manual");
}
function syncJog() {
  if (!jogQ) return;
  jogSliders.forEach((s, i) => {
    s.input.value = String(jogQ[i]);
    s.val.textContent = jogQ[i].toFixed(1);
  });
  const g = $("jog-grip");
  if (g && document.activeElement !== g) g.value = String(jogGrip);
  $("jog-grip-n").textContent = jogGrip.toFixed(2);
}

const xyz = $("jog-xyz");
for (const [label, d] of [["+X", [10, 0, 0]], ["−X", [-10, 0, 0]], ["+Y", [0, 10, 0]], ["−Y", [0, -10, 0]], ["+Z", [0, 0, 10]], ["−Z", [0, 0, -10]]]) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label + " 10";
  b.addEventListener("click", () => {
    ensureJog();
    const f = fk(jogQ);
    const sol = ik({ R: f.R, p: f.p.map((v, i) => v + d[i]) }, jogQ);
    if (!sol) { $("jog-note").textContent = "No IK solution for that WORLD step."; return; }
    jogQ = sol.q.slice();
    $("jog-note").textContent = "WORLD step, " + sol.cfg + ".";
    syncJog();
  });
  xyz.append(b);
}
$("jog-grip").addEventListener("input", (e) => {
  ensureJog();
  jogGrip = Number(e.target.value);
  $("jog-grip-n").textContent = jogGrip.toFixed(2);
});

const pathGeom = new THREE.BufferGeometry().setFromPoints(S.tcp.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
const pathLine = new THREE.Line(pathGeom, new THREE.LineBasicMaterial({ color: 0xF5C221 }));
world.add(pathLine);
const trail = $("trail");
if (trail) trail.addEventListener("change", (e) => { pathLine.visible = e.target.checked; });

let shownLine = -1;
function refreshUI(t, pose) {
  const line = lineAt(t);
  const moved = parts.filter((p) => p.place <= t).length;
  $("live-line").textContent = mode === "manual" ? "JOG" : String(line);
  $("live-state").textContent = mode === "manual" ? "manual" : ((pose.seg && pose.seg.cmd) ? pose.seg.cmd.trim() : "—");
  $("live-grip").textContent = pose.grip > 0.5 ? "closed" : "open";
  $("live-moved").textContent = moved + "/10";
  const nowMm = clearanceNow(t) * 1000;
  $("live-now").textContent = nowMm.toFixed(1) + " mm";
  $("live-min").textContent = (minClear.m * 1000).toFixed(1) + " mm";
  if (line !== shownLine) {
    shownLine = line;
    tpBox.querySelectorAll("button").forEach((b) => {
      const on = Number(b.dataset.line) === line;
      b.classList.toggle("cur", on);
      if (on) b.scrollIntoView({ block: "nearest" });
    });
  }
  const io = ioAt(t);
  for (const [group, key] of IO_NAMES) lampNodes[group + key].classList.toggle("on", io[group][key] === 1);
  pose.q.forEach((v, i) => {
    const row = jointRead[i];
    const u = (v - row.lo) / (row.hi - row.lo);
    row.mark.style.left = (Math.max(0, Math.min(1, u)) * 100) + "%";
    row.val.textContent = v.toFixed(1) + "°";
  });
  $("j3-note").textContent = "J2+J3 = " + (pose.q[1] + pose.q[2]).toFixed(1) + "°  (coupled −69…205)";
  const R = fk(pose.q).R;
  const w0 = wprOf(R);
  const world = sceneToWorld(pose.tcp);
  ["X", "Y", "Z"].forEach((k, i) => { tcpUF0[k].textContent = world[i].toFixed(1); });
  ["W", "P", "R"].forEach((k, i) => { tcpUF0[k].textContent = w0[i].toFixed(1); });
  const u1 = uf1Of(pose.tcp, R);
  ["X", "Y", "Z"].forEach((k, i) => { tcpUF1[k].textContent = u1.p[i].toFixed(1); });
  ["W", "P", "R"].forEach((k, i) => { tcpUF1[k].textContent = u1.wpr[i].toFixed(1); });
  if (mode === "manual" && document.activeElement?.type !== "range") syncJog();
}
window.pcHooks = Object.assign(window.pcHooks || {}, { refreshUI });
