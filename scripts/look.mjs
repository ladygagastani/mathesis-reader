// Screenshots of some screens at a computer's width, for a quick look while building (scripts/shots.mjs takes them all).
// usage: node scripts/look.mjs <base-url> <out-folder> [name filter] [theme]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { SCREENS, open, prepare } from "./screens.mjs";

const [base = "http://localhost:3300", out = "screenshots/look", filter = "", theme = "paper"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const s of SCREENS.filter((x) => x.name.includes(filter))) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await prepare(ctx, { theme, columns: s.columns, synced: s.synced, notes: s.notes });
  const page = await ctx.newPage();
  try { await open(page, base, s); await page.screenshot({ path: `${out}/${s.name.replace(/[ ,]+/g, "-")}-${theme}.png` }); }
  catch (e) { console.log(`${s.name}: ${String(e).split("\n")[0]}`); }
  await ctx.close();
}
await browser.close();
