/**
 * Serve the static build (out/, from `npm run build`) the way GitHub Pages does: /stoa/census is
 * out/stoa/census.html, a folder is its index.html, anything else missing is out/404.html. Used by
 * `npm start` and the browser tests, since `next start` does not work with `output: "export"`.
 * Text files are sent gzip-compressed, as GitHub Pages sends them, so speed measured here is realistic.
 *
 *   node scripts/serve-out.mjs [port]      (default 3100)
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { createGzip } from "node:zlib";

const ROOT = join(import.meta.dirname, "..", "out");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3100);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webm": "audio/webm", ".m4a": "audio/mp4", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
};

if (!existsSync(ROOT)) {
  console.error("out/ does not exist: run `npm run build` first");
  process.exit(1);
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (path.startsWith("..")) { res.writeHead(400).end(); return; }
  const base = join(ROOT, path);
  // a page's prefetch files: a build made on Windows writes __next.stoa.__PAGE__.txt as __next.stoa/__PAGE__.txt
  const name = path.split(/[/\\]/).pop() ?? "";
  const nested = /^__next\..+\.txt$/.test(name) ? join(base, "..", name.slice(0, -4).split(".").slice(1).reduce((a, x, i) => (i ? `${a}/${x}` : `__next.${x}`), "") + ".txt") : null;
  const file = [base, `${base}.html`, join(base, "index.html"), ...(nested ? [nested] : [])].find(isFile);
  const found = file ?? join(ROOT, "404.html");
  // extensionless files are the app's icons (PNG)
  const type = TYPES[extname(found)] ?? (found.includes(`${join("out", "icons")}`) ? "image/png" : "application/octet-stream");
  const gzip = /^(text\/|application\/(json|xml|manifest)|image\/svg)/.test(type) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
  res.writeHead(file ? 200 : 404, { "Content-Type": type, ...(gzip ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}) });
  if (req.method === "HEAD") { res.end(); return; }
  (gzip ? createReadStream(found).pipe(createGzip()) : createReadStream(found)).pipe(res);
}).listen(PORT, () => console.log(`serving out/ at http://localhost:${PORT}`));
