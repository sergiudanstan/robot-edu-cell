// One cycle film of the educational cell.
// Usage: node tools/record.mjs
// Writes ~/Downloads/fanuc_edu_cell/fanuc_edu_cell.mp4 (h264, yuv420p, 1920x1080).
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import("/opt/homebrew/lib/node_modules/playwright/index.mjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(homedir(), "Downloads/fanuc_edu_cell");
const outFile = join(outDir, "fanuc_edu_cell.mp4");
const frames = "/tmp/fec_frames";

mkdirSync(outDir, { recursive: true });
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const server = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("http.server did not answer\n" + serverLog)), 8000);
    const ping = async () => {
      if (server.exitCode != null) { clearTimeout(timer); reject(new Error("http.server exited\n" + serverLog)); return; }
      try {
        const r = await fetch("http://127.0.0.1:8777/index.html");
        if (r.status < 500) { clearTimeout(timer); resolve(); return; }
      } catch { /* not up yet */ }
      setTimeout(ping, 100);
    };
    ping();
  });

  browser = await chromium.launch({
    channel: "chrome", headless: true, args: ["--window-size=1920,1080"],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto("http://127.0.0.1:8777/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.pcReady === true, { timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.setQuality(true);
    window.pc.pause();
    const trail = document.getElementById("trail");
    if (trail && trail.checked) trail.click();
  });
  const duration = await page.evaluate(() => window.pc.DURATION);
  const n = Math.floor(duration * 30) + 1;
  console.log("frames", n, "duration", duration.toFixed(3));
  for (let k = 0; k < n; k++) {
    await page.evaluate((k) => {
      const D = window.pc.DURATION;
      const t = Math.min(k / 30, D);
      const u = t / D;
      const ang = -0.9 + u * 1.15;
      const dist = 2.25;
      const cx = Math.sin(ang) * dist;
      const cy = -Math.cos(ang) * 1.85;
      const cz = 0.42 + 0.18 * Math.sin(Math.PI * u);
      window.pc.pause();
      window.pc.seek(t);
      window.pc.setCamera([cx, cz, -cy], [0.02, 0.22, -0.02]);
    }, k);
    await page.screenshot({ path: join(frames, `f_${String(k).padStart(5, "0")}.jpg`), type: "jpeg", quality: 85 });
    if (k % 60 === 0) console.log("frame", k);
  }
  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-y", "-framerate", "30", "-i", join(frames, "f_%05d.jpg"),
      "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-color_range", "tv", "-crf", "18", "-movflags", "+faststart",
      outFile,
    ], { stdio: ["ignore", "inherit", "inherit"] });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg exit " + code))));
  });
  console.log(outFile);
  if (errors.length) {
    console.error("console errors", errors.length);
    for (const e of errors) console.error(e);
    process.exitCode = 1;
  } else console.log("console errors: 0");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
