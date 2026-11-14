// impeccable's design detector (npx impeccable detect), in three steps, each run only if the one before it passed:
//   1. the proof: test-fixtures/impeccable/known-bad.html must still be caught, with every pattern planted in it, so a
//      detector that has stopped seeing (a new version, a broken install) fails here instead of passing everything after;
//   2. the source, src/: the detector reads CSS and TSX by pattern only, so this finds less than step 3;
//   3. the built site, rendered: the library and the reader (its title page, as a first visit sees it), at a computer's
//      width and a phone's.
// usage: node scripts/check-impeccable.mjs [base-url]   (default http://localhost:3300, the built site: npm run start)
// exits with 1 on any finding, or when the proof fails. Pinned to one version, so a new release cannot change the result
// without a change here. A finding listed in JUDGED is printed but does not fail: each is one rule on one page, matched by the
// element's own words, with the reason it was judged right for this design. Keep the list short; a new finding is a fault until
// someone has looked at it and written the reason here.
import { spawnSync } from "node:child_process";

const VERSION = "4.9.0";
const base = (process.argv[2] ?? "http://localhost:3300").replace(/\/$/, "");
const PLANTED = ["side-tab", "gradient-text", "overused-font", "ai-color-palette", "dark-glow"];
const PAGES = ["/", "/read?w=tlg0059.tlg002"];
const VIEWPORTS = ["1280x800", "390x844"];
const JUDGED = [
  {
    rules: ["hero-eyebrow-chip", "kicker-above-heading"], page: "/read?w=tlg0059.tlg002", words: /ΠΛΑΤΩΝ/,
    why: "the author's name in spaced Greek capitals above the title, inside the title tondo: the old printed title page's order " +
      "(DESIGN.md, \"Ornament\", the title tondo), not a marketing kicker",
  },
];
const judged = (p, f) => JUDGED.find((j) => j.rules.includes(f.antipattern) && j.page === p && j.words.test(f.snippet ?? ""));

function detect(...args) {
  const r = spawnSync("npx", ["--yes", `impeccable@${VERSION}`, "detect", "--json", "--no-advisory", ...args], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 1 << 26 });
  let found = [];
  try { found = JSON.parse(r.stdout || "[]"); } catch { /* left empty; the exit code says what happened */ }
  return { status: r.status, found, err: r.stderr };
}
const say = (f) => `  [${f.antipattern}] ${f.file ? f.file.replace(process.cwd(), ".") + (f.line ? `:${f.line}` : "") : ""} ${f.snippet ?? ""}`.trimEnd();

// 1. the proof
const proof = detect("test-fixtures/impeccable/known-bad.html");
const caught = new Set(proof.found.map((f) => f.antipattern));
const missed = PLANTED.filter((p) => !caught.has(p));
if (proof.status !== 2 || missed.length) {
  console.log(`✗ the detector no longer catches the known-bad page (exit ${proof.status}; missed: ${missed.join(", ") || "none"}). Its result below would not mean anything.`);
  if (proof.err) console.log(proof.err.split("\n").slice(-5).join("\n"));
  process.exit(1);
}
console.log(`✓ proof: the known-bad page is caught (${[...caught].join(", ")})`);

// 2. the source, 3. the rendered pages
let problems = 0;
const src = detect("src");
if (src.status === 1) { console.log("✗ src could not be scanned"); problems++; }
for (const f of src.found) { console.log(say(f)); problems++; }
console.log(`${src.found.length ? "✗" : "✓"} src: ${src.found.length} finding(s)`);
for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    const r = detect("--viewport", vp, base + p);
    if (r.status === 1) { console.log(`✗ ${p} at ${vp} could not be scanned. Is the built site running (npm run start)?`); problems++; continue; }
    let faults = 0;
    for (const f of r.found) {
      const j = judged(p, f);
      if (j) { console.log(`${say(f)}\n    judged right: ${j.why}`); continue; }
      console.log(say(f)); faults++;
    }
    problems += faults;
    console.log(`${faults ? "✗" : "✓"} ${p} at ${vp}: ${faults} finding(s)${r.found.length > faults ? `, ${r.found.length - faults} judged` : ""}`);
  }
}
console.log(problems ? `\n${problems} problem(s)` : "\nno finding: the detector passes the source and the rendered pages");
process.exit(problems ? 1 : 0);
