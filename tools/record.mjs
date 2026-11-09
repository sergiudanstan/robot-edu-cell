// Deterministic cycle film. Frames are pc.seek(k/30), two animation frames, then a JPEG.
// Usage: node tools/record.mjs
// Writes ~/ZCodeProject/output/praline_cell_pro/praline_cell_pro.mp4 (?cad=0)
// and, when _cad/t3.glb is present, praline_cell_pro_cad_local.mp4 (local only).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import("/opt/homebrew/lib/node_modules/playwright/index.mjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(homedir(), "Downloads/fanuc_edu_cell");
const frames = "/tmp/fec_frames";
const hasCad = existsSync(join(root, "_cad/t3.glb"));

mkdirSync(outDir, { recursive: true });

const server = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

function ffmpeg(out) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-y", "-framerate", "30", "-i", join(frames, "f_%05d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
      out,
    ], { stdio: ["ignore", "inherit", "inherit"] });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg exit " + code))));
  });
}

let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("http.server did not answer")), 8000);
    const ping = async () => {
      if (server.exitCode != null) { clearTimeout(timer); reject(new Error("http.server exited\n" + serverLog)); return; }
      try {
        const r = await fetch("http://127.0.0.1:8777/");
        if (r.status < 500) { clearTimeout(timer); resolve(); return; }
      } catch { /* not up yet */ }
      setTimeout(ping, 100);
    };
    ping();
  });

  browser = await chromium.launch({
    channel: "chrome", headless: false, args: ["--window-size=2000,1200"],
  });

  async function film(query, out) {
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().includes("_cad/t3.glb")) errors.push(msg.text()); });
    page.on("pageerror", (err) => { const t = String(err); if (!t.includes("_cad/t3.glb")) errors.push(t); });
    await page.goto("http://127.0.0.1:8777/index.html" + query, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.pcReady === true, { timeout: 45000 });
    await page.waitForTimeout(3200);
    await page.evaluate(() => window.setQuality(true));
    const duration = await page.evaluate(() => window.pc.DURATION);
    const n = Math.floor(duration * 30) + 1;
    console.log(query || "(cad)", "frames", n, "duration", duration.toFixed(2));
    for (let k = 0; k < n; k++) {
      await page.evaluate((k) => {
        const duration = window.pc.DURATION;
        const t = Math.min(k / 30, duration);
        window.pc.pause();
        window.pc.seek(t);
        const views = window.pcViews;
        let pose;
        if (t >= 12 && t < 18) pose = views.t3a;
        else if (t >= 25 && t < 30) pose = views.delta;
        else {
          const ang = (t / duration - 0.5) * 40 * Math.PI / 180;
          const iso = views.iso;
          const dx = iso.pos.x - iso.target.x, dz = iso.pos.z - iso.target.z;
          const c = Math.cos(ang), s = Math.sin(ang);
          pose = {
            pos: { x: iso.target.x + dx * c - dz * s, y: iso.pos.y, z: iso.target.z + dx * s + dz * c },
            target: iso.target,
          };
        }
        window.pc.setCamera([pose.pos.x, pose.pos.y, pose.pos.z], [pose.target.x, pose.target.y, pose.target.z]);
      }, k);
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      const file = join(frames, `f_${String(k + 1).padStart(5, "0")}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 92 });
      if (k % 100 === 0) console.log("frame", k);
    }
    await page.close();
    if (errors.length) {
      console.error(errors.slice(0, 8).join("\n"));
      throw new Error(errors.length + " console errors during " + query);
    }
    await ffmpeg(out);
    rmSync(frames, { recursive: true, force: true });
    console.log(out);
  }

  await film("?cad=0", join(outDir, "praline_cell_pro.mp4"));
  if (hasCad) await film("", join(outDir, "praline_cell_pro_cad_local.mp4"));
  else console.log("no _cad/t3.glb, skipped the local CAD film");
} finally {
  rmSync(frames, { recursive: true, force: true });
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
