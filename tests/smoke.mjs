// Headless smoke test: serve the repo, load index.html in Chromium and fail on
// any uncaught page error, failed module load or console error, or if the
// scene never draws a WebGL canvas.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
// The browser asks for /favicon.ico on its own; a missing one is not a page fault.
const ignored = (u) => new URL(u).pathname === "/favicon.ico";
page.on("console", (m) => { if (m.type() === "error" && !(m.location()?.url && ignored(m.location().url))) problems.push(`console.error: ${m.text()} (${m.location()?.url ?? ""})`); });
page.on("response", (r) => { if (r.status() >= 400 && !ignored(r.url())) problems.push(`http ${r.status()}: ${r.url()}`); });
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(3000);
const canvas = await page.evaluate(() => { const c = document.querySelector("canvas"); return c ? [c.width, c.height] : null; });
await browser.close();
server.close();

if (!canvas || canvas[0] === 0 || canvas[1] === 0) problems.push("no rendered <canvas> after load");
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`ok: ${url} loaded, canvas ${canvas[0]}x${canvas[1]}, no errors`);
