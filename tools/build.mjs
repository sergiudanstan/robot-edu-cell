// Builds index.html from src/page.html + src/js/*.js (lexical order), checks the module syntax, writes atomically.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, readdirSync, renameSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "src/page.html"), "utf8");
const MARK = "<!-- @@MODULE -->";
if (page.split(MARK).length !== 2) throw new Error(`src/page.html must contain ${MARK} exactly once`);
const dir = join(root, "src/js");
const parts = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const js = parts.map((f) => readFileSync(join(dir, f), "utf8")).join("");

// syntax check of the concatenated module (node --check parses only, imports are not resolved)
const tmp = mkdtempSync(join(tmpdir(), "pcp-build-"));
try {
  writeFileSync(join(tmp, "module.mjs"), js);
  execFileSync(process.execPath, ["--check", join(tmp, "module.mjs")], { stdio: "inherit" });
} catch {
  console.error("build: syntax error in src/js (see above); index.html NOT written");
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const html = page.replace(MARK, () => `<script type="module">\n${js}</script>`);
const out = join(root, "index.html");
writeFileSync(out + ".tmp", html);
renameSync(out + ".tmp", out);
console.log(`index.html built from ${parts.length} fragments, ${html.length} bytes`);
