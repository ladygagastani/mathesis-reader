// The design check (DESIGN.md, Tondo: "three typefaces and no more", colours only from the roles), on what each screen actually
// draws, at a computer's width and a phone's, in Day ("paper" in the settings) and in Night. For every visible piece of words it
// lists:
//   face    - a letter or sign drawn in a typeface other than Literata, Noto Serif Display and Hanken Grotesk. The browser is
//             asked which font drew each piece, so a sign none of the three has (an arrow, a cross) is caught, letter by letter.
//   size    - a size below 12 px, or, up to the title step, not a step of the type scale. Lettering in Noto Serif Display, the
//             page's title, and the Greek being read at the reader's own size are not judged.
//   colour  - words in a colour that is not a token for words: --ink, --ink-2, --ink-3, --accent; on a block of ink, the ground
//             and --ink-2-on-ink; on a terracotta field, the ground.
//   button  - a filled button whose fill is not --btn-bg (terracotta), the one primary fill.
// usage: node scripts/check-design.mjs <base-url>   (exits with 1 on a problem)
//        PROVE_CSS="<css>" adds a style to every screen, to prove the check finds what it should.
// Proved 2026-11-12 on the old look: PROVE_CSS='.btn { background: #c8b428 !important }' lists the filled buttons, and
// PROVE_CSS='h1 span { font-family: Arial !important }' lists the one-line title's signs (face: "·" in Arial). Proved again
// 2026-11-14 on Tondo (see the commit that brought Tondo in).
import { chromium } from "playwright";
import { SCREENS, forWidth, open, prepare, within } from "./screens.mjs";

const [base = "http://localhost:3300"] = process.argv.slice(2);
const THREE = ["Literata", "Noto Serif Display", "Hanken Grotesk"];
const browser = await chromium.launch();
const found = [];
const tally = { face: new Map(), size: new Map(), colour: new Map(), fill: new Map() };
const count = (m, k, where) => { const x = m.get(k) ?? { n: 0, where: new Set() }; x.n++; x.where.add(where); m.set(k, x); };

// which fonts drew the visible words, and which letters fell outside the three. The words are grouped by everything that picks a
// font (family, weight, style, stretch, language); each group's letters are drawn once, in a probe inside one of its elements, and
// only a group that reaches another font is drawn again letter by letter. One element at a time took minutes on a long page.
async function faces(page, ctx, at) {
  const groups = await page.evaluate(() => {
    const by = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const e = t.parentElement;
      if (!e || !t.textContent.trim() || e.closest("script, style, noscript, [hidden], .visually-hidden")) continue;
      const b = e.getBoundingClientRect(), s = getComputedStyle(e);
      if (!b.width || !b.height || s.visibility === "hidden" || +s.opacity === 0) continue;
      const key = [s.fontFamily, s.fontWeight, s.fontStyle, s.fontStretch, e.closest("[lang]")?.lang ?? ""].join("|");
      let g = by.get(key);
      if (!g) { g = { el: e, seen: new Map() }; by.set(key, g); }
      const words = (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
      for (const c of t.textContent.replace(/\s/g, "")) if (!g.seen.has(c)) g.seen.set(c, words);
    }
    return [...by.values()].map((g, i) => {
      const set = [...g.seen.keys()];
      const all = document.createElement("span");
      all.textContent = set.join("");
      all.setAttribute("data-face-probe", `${i}`);
      g.el.append(all);
      set.forEach((c, k) => { const s = document.createElement("span"); s.textContent = c; s.setAttribute("data-face-probe", `${i}-${k}`); g.el.append(s); });
      return { set, words: set.map((c) => g.seen.get(c)) };
    });
  });
  if (!groups.length) return [];
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const drawn = async (sel) => {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-face-probe="${sel}"]` });
    return nodeId ? (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts.filter((f) => !THREE.includes(f.familyName)) : [];
  };
  const out = [];
  for (const [i, g] of groups.entries()) {
    if (!(await drawn(`${i}`)).length) continue;
    for (const [k, c] of g.set.entries())
      for (const f of await drawn(`${i}-${k}`)) out.push([`U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} "${c}" in ${f.familyName}`, `${at} "${g.words[k]}"`]);
  }
  await cdp.detach();
  await page.evaluate(() => document.querySelectorAll("[data-face-probe]").forEach((p) => p.remove()));
  return out;
}

function judge(measureType) {
  const probe = document.createElement("span");
  document.body.append(probe);
  const steps = ["--t-label", "--t-small", "--t-ui", "--t-body", "--t-lead", "--t-head", "--t-title"].map((v) => {
    probe.style.fontSize = `var(${v})`;
    return parseFloat(getComputedStyle(probe).fontSize);
  });
  const pen = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  const rgba = (c) => {
    probe.style.color = "";
    probe.style.color = c;
    pen.clearRect(0, 0, 1, 1);
    pen.fillStyle = getComputedStyle(probe).color;
    pen.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pen.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const near = (x, y) => Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) <= 9 && Math.abs(x[3] - y[3]) < 0.03;
  const token = (e, v) => rgba(getComputedStyle(e).getPropertyValue(v).trim());
  const show = (c) => `rgb${c[3] < 1 ? "a" : ""}(${c.slice(0, 3).join(", ")}${c[3] < 1 ? `, ${c[3].toFixed(2)}` : ""})`;
  const ground = (e) => {
    for (let x = e; x; x = x.parentElement) {
      const bg = rgba(getComputedStyle(x).backgroundColor);
      if (bg[3] >= 0.5) return bg;
    }
    return null;
  };
  const out = { size: [], colour: [], fill: [] };
  const display = getComputedStyle(document.documentElement).getPropertyValue("--font-display").split(",")[0].trim();
  const skip = (e) => e.closest("[aria-hidden=true], script, style, noscript, [hidden], .visually-hidden");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(), sizes = new Map();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || seen.has(e) || !t.textContent.trim() || skip(e)) continue;
    seen.add(e);
    const b = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!b.width || !b.height || s.visibility === "hidden" || +s.opacity === 0) continue;
    const word = t.textContent.trim().slice(0, 24);
    if (measureType) {
      const px = parseFloat(s.fontSize);
      // the title is fluid by design, lettering in Noto Serif Display is display lettering (the dictionary form is sized to its
      // letters), and the reader's text (its Greek, its English beside the Greek, and the marks inside them, sized from the text as
      // an edition's are) is sized by the reader in Aa
      let lettering = !!e.closest("h1") || !!e.closest("[data-u], [data-reading]");
      for (let x = e; x && !lettering && parseFloat(getComputedStyle(x).fontSize) === px; x = x.parentElement) lettering = getComputedStyle(x).fontFamily.includes(display);
      // the reading size, measured once for each value of --greek-size: moving the probe into every element forced a layout of the
      // whole page each time, and a page of 2,000 words took longer than the time limit
      const said = s.getPropertyValue("--greek-size").trim();
      if (!lettering && !sizes.has(said)) {
        probe.style.fontSize = "var(--greek-size)";
        e.append(probe);
        sizes.set(said, parseFloat(getComputedStyle(probe).fontSize));
        document.body.append(probe);
      }
      const at = sizes.get(said) ?? NaN;
      const reading = Math.abs(at - px) < 0.6 || Math.abs(at * 0.9 - px) < 0.6;
      if (lettering || reading) { /* not judged */ }
      else if (px < 11.9) out.size.push([`${Math.round(px * 100) / 100}px (under 12)`, word]);
      else if (px <= steps[6] + 0.6 && !steps.some((v) => Math.abs(v - px) < 0.6)) out.size.push([`${Math.round(px * 100) / 100}px`, word]);
    }
    const bg = ground(e);
    const onInk = bg && near(bg, token(e, "--ink")), onRed = bg && near(bg, token(e, "--accent"));
    const ok = (onInk ? ["--bg", "--ink-2-on-ink"] : onRed ? ["--bg"] : ["--ink", "--ink-2", "--ink-3", "--accent"]).map((v) => token(e, v));
    const colour = rgba(s.color);
    if (!ok.some((c) => near(c, colour))) out.colour.push([`${show(colour)}${onInk ? " on the ink" : onRed ? " on the red" : ""}`, word]);
  }
  for (const e of document.querySelectorAll("main a, main button, nav a, nav button")) {
    if (skip(e) || e.matches("[role=radio], [aria-pressed], [aria-current]")) continue;
    const s = getComputedStyle(e), b = e.getBoundingClientRect();
    if (!b.width || !e.textContent.trim() || b.height > 72) continue;
    const bg = rgba(s.backgroundColor);
    if (bg[3] < 0.5) continue;
    const around = ground(e.parentElement);
    if (around && near(bg, around)) continue;
    // a button is filled in terracotta, or is a quiet one on the second surface (Listen at the foot of a phone's screen)
    if (!near(bg, token(e, "--btn-bg")) && !near(bg, token(e, "--surface"))) out.fill.push([`${show(bg)} with ${show(rgba(s.color))}`, e.textContent.trim().slice(0, 24)]);
  }
  probe.remove();
  return out;
}

for (const theme of (process.env.THEME ? [process.env.THEME] : ["paper", "night"])) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const s of SCREENS.filter(forWidth(w)).filter((s) => !process.env.ONLY || new RegExp(process.env.ONLY).test(s.name))) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", hasTouch: w < 500, isMobile: w < 500 });
      await prepare(ctx, { theme, columns: s.columns, synced: s.synced, notes: s.notes, words: s.words, reading: s.reading });
      if (process.env.PROVE_CSS) await ctx.addInitScript((c) => addEventListener("load", () => document.head.append(Object.assign(document.createElement("style"), { textContent: c }))), process.env.PROVE_CSS);
      const page = await ctx.newPage();
      const at = `${s.name} ${w}px ${theme}`;
      try {
        await within(at, async () => {
          await open(page, base, s);
          const r = await page.evaluate(judge, theme === "paper");
          for (const k of ["size", "colour", "fill"]) for (const [v, word] of r[k]) count(tally[k], v, `${at} "${word}"`);
          if (theme === "paper") for (const [v, where] of await faces(page, ctx, at)) count(tally.face, v, where);
        });
      } catch (e) {
        found.push(`load ${at}: ${String(e).split("\n")[0]}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();

const report = (kind, entries) => { for (const [v, x] of [...entries].sort((a, b) => b[1].n - a[1].n)) found.push(`${kind} ${v}: ${x.n} time(s), e.g. ${[...x.where].slice(0, 3).join(" · ")}`); };
report("face", tally.face.entries());
report("size", tally.size.entries());
report("colour", tally.colour.entries());
report("button", tally.fill.entries());
for (const f of found) console.log(`✗ ${f}`);
console.log(found.length ? `\n${found.length} problem(s)` : "every letter in the three typefaces; every size, colour and button one of the app's own");
process.exit(found.length ? 1 : 0);
