// Deterministic Playwright stills of the cell, plus console errors and an fps reading.
// Usage: node tools/shots.mjs [--quick]
//   --quick  iso at 45% of the cycle only
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import("/opt/homebrew/lib/node_modules/playwright/index.mjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(homedir(), "Downloads/fanuc_edu_cell/shots");
const quick = process.argv.includes("--quick");
const views = ["iso", "front", "side", "top", "robot", "board", "camera"];
const fracs = [0.15, 0.45, 0.75];

mkdirSync(outDir, { recursive: true });

const server = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

const errors = [];
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("http.server did not answer on 127.0.0.1:8777")), 8000);
    const ping = async () => {
      if (server.exitCode != null) {
        clearTimeout(timer);
        reject(new Error("http.server exited\n" + serverLog));
        return;
      }
      try {
        const r = await fetch("http://127.0.0.1:8777/");
        if (r.status < 500) { clearTimeout(timer); resolve(); return; }
      } catch { /* not up yet */ }
      setTimeout(ping, 100);
    };
    ping();
  });

  browser = await chromium.launch({
    channel: "chrome", headless: false, args: ["--window-size=1700,1050"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("http://127.0.0.1:8777/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.pcReady === true, { timeout: 45000 });
  await page.waitForTimeout(3200);
  await page.evaluate(() => window.setQuality(true));

  const duration = await page.evaluate(() => window.pc.DURATION);
  const shots = quick ? [["iso", duration * 0.45]] : views.flatMap((v) => fracs.map((f) => [v, duration * f]));
  for (const [v, t] of shots) {
    await page.evaluate(({ v, t }) => {
      window.pc.pause();
      window.pc.seek(t);
      window.pc.setView(v);
    }, { v, t });
    await page.waitForTimeout(900);
    const file = join(outDir, `${v}_${t.toFixed(1)}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }

  const checks = await page.evaluate(() => ({
    robot: window.pc.robotCheck?.() ?? null,
    duration: window.pc.DURATION,
    holes: window.pc.HOLES?.length ?? null,
    hq: window.__hqStats ?? null,
  }));
  console.log("DURATION", checks.duration);
  if (checks.holes != null) console.log("HOLES", checks.holes);
  if (checks.robot != null) console.log("robotCheck mm", checks.robot);
  if (checks.hq) console.log("watchdog avgMs", checks.hq.avgMs.toFixed(1), "tripped", checks.hq.tripped);

  async function fps(on) {
    await page.evaluate((hq) => { window.setQuality(hq); window.pc.setView("iso"); window.pc.play(); }, on);
    await page.waitForTimeout(600);
    return page.evaluate(() => new Promise((resolve) => {
      const t0 = performance.now();
      let frames = 0;
      const step = (now) => {
        frames += 1;
        if (now - t0 >= 2000) resolve(frames * 1000 / (now - t0));
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }));
  }
  const fpsHq = await fps(true);
  const fpsOff = await fps(false);
  console.log(`fps HQ ${fpsHq.toFixed(1)}`);
  console.log(`fps noHQ ${fpsOff.toFixed(1)}`);

  if (errors.length) {
    console.error(`console errors: ${errors.length}`);
    for (const e of errors) console.error(e);
    process.exitCode = 1;
  } else console.log("console errors: 0");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
