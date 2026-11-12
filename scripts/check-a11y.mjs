// The accessibility and touch check, lifted from the old app's web/scripts/check-a11y.mjs, over every screen at a computer's
// width and on a phone, in Paper and in Night. It lists:
//   axe    - what axe (the standard automated checker, WCAG 2.1 AA rules) calls serious or critical, contrast among them
//   empty  - a heading with nothing to read
//   tap    - on a phone, a link, button or field whose touch area is under 44 × 44 px. A target inside running text is exempt, as
//            WCAG 2.5.8 allows (a Greek word in its sentence, a link in a line of LSJ); a hit area widened by the CSS counts.
// usage: node scripts/check-a11y.mjs <base-url>   (exits with 1 on a problem)
//        PROVE_CSS="<css>" adds a style to every screen, to prove the check finds what it should.
// Proved 2026-11-12: PROVE_CSS='main h1 { color: #c9bfae !important }' lists color-contrast on every reader screen in Paper, and
// PROVE_CSS='.icon-btn { width: 20px !important; height: 20px !important; min-width: 20px !important; min-height: 20px !important }'
// lists "Close the look-up 20×20" and "Close Page and text 20×20" under tap.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { SCREENS, open, prepare } from "./screens.mjs";

const [base = "http://localhost:3300"] = process.argv.slice(2);
const browser = await chromium.launch();
const found = [];

for (const [w, h, phone, theme] of [[1440, 900, false, "paper"], [1440, 900, false, "night"], [390, 844, true, "paper"], [390, 844, true, "night"]]) {
  for (const s of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, reducedMotion: "reduce" });
    await prepare(ctx, { theme, columns: s.columns, signedIn: s.signedIn });
    if (process.env.PROVE_CSS) await ctx.addInitScript((c) => addEventListener("load", () => document.head.append(Object.assign(document.createElement("style"), { textContent: c }))), process.env.PROVE_CSS);
    const page = await ctx.newPage();
    const at = `${s.name} ${w}px ${theme}`;
    try {
      await open(page, base, s);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"))
        found.push(`axe ${at}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" · ")}`);
      if (theme === "night") continue;   // the rest does not change with the look

      const r = await page.evaluate((phone) => {
        const shown = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
        const empty = [...document.querySelectorAll("h1, h2, h3, h4")].filter((hd) => shown(hd) && !(hd.getAttribute("aria-label") || hd.textContent).trim()).map((hd) => hd.outerHTML.slice(0, 80));
        const tap = [];
        if (phone) {
          const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio]";
          const seen = new Set();
          for (const el of document.querySelectorAll(sel)) {
            if (el.disabled || el.closest("[inert], [aria-hidden=true]") || !shown(el)) continue;
            const b0 = el.getBoundingClientRect();
            if (b0.width >= 44 && b0.height >= 44) continue;
            // a target inside running text: the sentence around it is its spacing (WCAG 2.5.8, inline); and a word of the text being
            // read, whose size is set by the text's line height wherever it stands, even alone on its line (WCAG 2.5.8: "otherwise
            // constrained by the line-height")
            const block = el.parentElement?.closest("p, li, dd, span, div");
            if (getComputedStyle(el).display === "inline" && block && block.textContent.trim().length > el.textContent.trim().length + 2) continue;
            if (el.matches("[data-u] [role=button]")) continue;
            el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
            const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
            const mine = (t) => t === el || el.contains(t);
            const hits = (x, y) => {
              const under = document.elementsFromPoint(x, y);
              const i = under.findIndex(mine);
              return i >= 0 && !under.slice(0, i).some((t) => t.matches(sel) && !t.contains(el));
            };
            if (!mine(document.elementFromPoint(cx, cy) ?? document.body)) continue;   // covered here: not this check's to judge
            const r = 21.5, square = (ox, oy) => [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]
              .map(([dx, dy]) => [cx + ox + dx, cy + oy + dy]).filter(([x, y]) => x >= 0 && x < innerWidth && y >= 0 && y < innerHeight);
            const shifts = [[0, 0], [0, -12], [0, 12], [-12, 0], [12, 0], [-12, -12], [12, -12], [-12, 12], [12, 12]];
            if (shifts.some(([ox, oy]) => square(ox, oy).every(([x, y]) => hits(x, y)))) continue;
            const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 30);
            const k = `${name} ${Math.round(b.width)}×${Math.round(b.height)}`;
            if (!seen.has(k)) { seen.add(k); tap.push(k); }
          }
        }
        return { empty, tap };
      }, phone);
      for (const t of r.empty) found.push(`empty ${at}: ${t}`);
      if (r.tap.length) found.push(`tap ${at}: ${r.tap.length} target(s) under 44 × 44 px: ${r.tap.slice(0, 12).join(" · ")}`);
    } catch (e) {
      found.push(`load ${at}: ${String(e).split("\n")[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
for (const f of found) console.log(`✗ ${f}`);
console.log(found.length ? `\n${found.length} problem(s)` : "accessibility and touch are in order");
process.exit(found.length ? 1 : 0);
