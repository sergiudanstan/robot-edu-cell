// Playback. frame() calls renderFrame(). THREE.Timer drives the loop.
let time = 0, playing = true, speed = 1;
const playIcon = $("play-icon");
function setPlaying(p) {
  playing = p;
  if (playIcon) playIcon.innerHTML = p ? '<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"/>' : '<path d="M7 4.5v15l13-7.5z"/>';
  const btn = $("play");
  if (btn) btn.setAttribute("aria-label", p ? "Pause" : "Play");
}
function seek(t) { time = Math.min(DURATION, Math.max(0, t)); }
const playBtn = $("play");
if (playBtn) playBtn.addEventListener("click", () => {
  if (mode !== "program") setMode("program");
  if (!playing && time >= DURATION - 1e-6) time = 0;
  setPlaying(!playing);
});
document.querySelectorAll(".chips button").forEach((b) => b.addEventListener("click", () => {
  speed = Number(b.dataset.speed);
  document.querySelectorAll(".chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
const loopBox = $("loop");
const tl = $("timeline");
let scrubbing = false;
function scrubTo(e) {
  const r = tl.getBoundingClientRect();
  seek(((e.clientX - r.left) / r.width) * DURATION);
}
if (tl) {
  tl.addEventListener("pointerdown", (e) => { scrubbing = true; tl.setPointerCapture(e.pointerId); scrubTo(e); });
  tl.addEventListener("pointermove", (e) => { if (scrubbing) scrubTo(e); });
  tl.addEventListener("pointerup", () => { scrubbing = false; });
}
function ease(u) { return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2; }

function update(dt) {
  if (mode === "program" && playing) {
    time += dt * speed;
    if (time >= DURATION) {
      if (loopBox && loopBox.checked) time %= DURATION;
      else { time = DURATION; setPlaying(false); }
    }
  }
  const pose = robotPose(time);
  setRobot(pose.q, pose.grip);
  placeParts(time);
  const vis = (segs.vision || []).find((s) => time >= s.t0 && time < s.t1 + 1e-9);
  if (typeof setLed === "function") setLed(!!(vis && vis.snap));
  const head = $("playhead");
  if (head) head.style.left = (100 * time / DURATION) + "%";
  const now = $("clock-now");
  const end = $("clock-end");
  if (now) now.textContent = time.toFixed(1);
  if (end) end.textContent = DURATION.toFixed(1);
}

const timer = new THREE.Timer();
timer.connect(document);
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 0.7);
    const e = ease(flight.t);
    camera.position.lerpVectors(flight.fromP, flight.toP, e);
    controls.target.lerpVectors(flight.fromT, flight.toT, e);
    if (flight.t >= 1) flight = null;
  }
  update(dt);
  controls.update();
  renderFrame();
  requestAnimationFrame(frame);
}
window.addEventListener("themechange", applyTheme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
syncPanels();
resize();
applyTheme();
setPlaying(true);
window.pc = {
  get segs() { return segs; },
  get parts() { return parts; },
  get DURATION() { return DURATION; },
  get minClear() { return minClear; },
  get S() { return S; },
  get HOLES() { return HOLES; },
  seek, pause: () => setPlaying(false), play: () => setPlaying(true), setView,
  setCamera(pos, target) {
    flight = null;
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  },
  ...(window.pcHooks || {}),
};
window.pcReady = true;
requestAnimationFrame(frame);
