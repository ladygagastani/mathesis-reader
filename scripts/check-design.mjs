// The design check, lifted from the old app's web/scripts/check-design.mjs (ADR 0008: "no typeface other than the three, and no
// colour outside the tokens"), on what each screen actually draws, at a computer's width and a phone's, in Paper and in Night.
// For every visible piece of words it lists:
//   face    - a letter or sign drawn in a typeface other than EB Garamond, GFS Didot and Gentium Book Plus. The browser is asked
//             which font drew each piece, so a sign none of the three has (an arrow, a cross) is caught, letter by letter.
//   size    - a size below 12 px, or, up to the h3 step, not a step of the type scale. Lettering in GFS Didot, the page's title,
//             and the Greek being read at the reader's own size are not judged.
//   colour  - words in a colour that is not a token for words: --ink, --ink-2, --ink-3, --rubric; on a block of ink, the paper
//             and --ink-2-on-ink; on a red field, the paper.
//   button  - a filled button whose fill is not the ink, the one primary fill.
// usage: node scripts/check-design.mjs <base-url>   (exits with 1 on a problem)
//        PROVE_CSS="<css>" adds a style to every screen, to prove the check finds what it should.
// Proved 2026-11-12: PROVE_CSS='.btn { background: #c8b428 !important }' lists the filled buttons (button: "Continue", Aa's "α−"
// and "α+"), and PROVE_CSS='h1 span { font-family: Arial !important }' lists the one-line title's signs (face: "·" in Arial).
import { chromium } from "playwright";
import { SCREENS, open, prepare } from "./screens.mjs";

const [base = "http://localhost:3300"] = process.argv.slice(2);
const THREE = ["EB Garamond", "GFS Didot", "Gentium Book Plus"];
const browser = await chromium.launch();
const found = [];
const tally = { face: new Map(), size: new Map(), colour: new Map(), fill: new Map() };
const count = (m, k, where) => { const x = m.get(k) ?? { n: 0, where: new Set() }; x.n++; x.where.add(where); m.set(k, x); };

// which fonts drew the words of each element, and for one not all in the three, which letters were not
async function faces(page, ctx, at) {
  const n = await page.evaluate(() => {
    let i = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const e = t.parentElement;
      if (!e || !t.textContent.trim() || e.hasAttribute("data-face-check") || e.closest("script, style, noscript, [hidden], .visually-hidden")) continue;
      const b = e.getBoundingClientRect(), s = getComputedStyle(e);
      if (!b.width || !b.height || s.visibility === "hidden" || +s.opacity === 0) continue;
      e.setAttribute("data-face-check", String(i++));
    }
    return i;
  });
  if (!n) return [];
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-face-check]" });
  const off = (f) => !THREE.includes(f.familyName);
  const out = [];
  for (const nodeId of nodeIds) {
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    if (!fonts.some(off)) continue;
    const { attributes } = await cdp.send("DOM.getAttributes", { nodeId });
    const i = attributes[attributes.indexOf("data-face-check") + 1];
    const letters = await page.evaluate((i) => {
      const e = document.querySelector(`[data-face-check="${i}"]`);
      const own = [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("");
      const set = [...new Set(own.replace(/\s/g, ""))];
      set.forEach((c, k) => { const s = document.createElement("span"); s.textContent = c; s.setAttribute("data-face-probe", `${i}-${k}`); e.append(s); });
      return { set, words: own.replace(/\s+/g, " ").trim().slice(0, 30) };
    }, i);
    for (let k = 0; k < letters.set.length; k++) {
      const probe = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-face-probe="${i}-${k}"]` });
      if (!probe.nodeId) continue;
      const drawn = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId: probe.nodeId })).fonts.filter(off);
      const c = letters.set[k];
      for (const f of drawn) out.push([`U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} "${c}" in ${f.familyName}`, `${at} "${letters.words}"`]);
    }
    await page.evaluate((i) => document.querySelectorAll(`[data-face-probe^="${i}-"]`).forEach((p) => p.remove()), i);
  }
  await cdp.detach();
  return out;
}

function judge(measureType) {
  const probe = document.createElement("span");
  document.body.append(probe);
  const steps = ["--step--2", "--step--1", "--step-0", "--step-sub", "--step-text", "--step-1", "--step-2", "--step-3", "--step-4"].map((v) => {
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
  const didot = getComputedStyle(document.documentElement).getPropertyValue("--font-didot").split(",")[0].trim();
  const skip = (e) => e.closest("[aria-hidden=true], script, style, noscript, [hidden], .visually-hidden");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || seen.has(e) || !t.textContent.trim() || skip(e)) continue;
    seen.add(e);
    const b = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!b.width || !b.height || s.visibility === "hidden" || +s.opacity === 0) continue;
    const word = t.textContent.trim().slice(0, 24);
    if (measureType) {
      const px = parseFloat(s.fontSize);
      // the title is fluid by design, lettering in GFS Didot is display lettering, and the reader's text (its Greek, its English
      // beside the Greek, and the marks inside them, sized from the text as an edition's are) is sized by the reader in Aa
      let display = !!e.closest("h1") || !!e.closest("[data-u], [data-reading]");
      for (let x = e; x && !display && parseFloat(getComputedStyle(x).fontSize) === px; x = x.parentElement) display = getComputedStyle(x).fontFamily.includes(didot);
      probe.style.fontSize = "var(--greek-size)";
      e.append(probe);
      const reading = Math.abs(parseFloat(getComputedStyle(probe).fontSize) - px) < 0.6 || Math.abs(parseFloat(getComputedStyle(probe).fontSize) * 0.9 - px) < 0.6;
      document.body.append(probe);
      if (display || reading) { /* not judged */ }
      else if (px < 11.9) out.size.push([`${Math.round(px * 100) / 100}px (under 12)`, word]);
      else if (px <= steps[6] + 0.6 && !steps.some((v) => Math.abs(v - px) < 0.6)) out.size.push([`${Math.round(px * 100) / 100}px`, word]);
    }
    const bg = ground(e);
    const onInk = bg && near(bg, token(e, "--ink")), onRed = bg && near(bg, token(e, "--rubric"));
    const ok = (onInk ? ["--bg", "--ink-2-on-ink"] : onRed ? ["--bg"] : ["--ink", "--ink-2", "--ink-3", "--rubric"]).map((v) => token(e, v));
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
    if (!near(bg, token(e, "--btn-bg"))) out.fill.push([`${show(bg)} with ${show(rgba(s.color))}`, e.textContent.trim().slice(0, 24)]);
  }
  probe.remove();
  return out;
}

for (const theme of ["paper", "night"]) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const s of SCREENS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", hasTouch: w < 500, isMobile: w < 500 });
      await prepare(ctx, { theme, columns: s.columns });
      if (process.env.PROVE_CSS) await ctx.addInitScript((c) => addEventListener("load", () => document.head.append(Object.assign(document.createElement("style"), { textContent: c }))), process.env.PROVE_CSS);
      const page = await ctx.newPage();
      const at = `${s.name} ${w}px ${theme}`;
      try {
        await open(page, base, s);
        const r = await page.evaluate(judge, theme === "paper");
        for (const k of ["size", "colour", "fill"]) for (const [v, word] of r[k]) count(tally[k], v, `${at} "${word}"`);
        if (theme === "paper") for (const [v, where] of await faces(page, ctx, at)) count(tally.face, v, where);
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
