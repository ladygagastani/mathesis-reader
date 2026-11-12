// Screenshots of every screen, at a computer's width and a phone's, for the owner to compare (and for the review of visual bugs).
// usage: node scripts/shots.mjs <base-url> <out-folder> [old]
//   with "old", the old app's reader on the live site is taken instead, on the same book and the same word (nothing is changed there).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { SCREENS, open, prepare } from "./screens.mjs";

const [base = "http://localhost:3300", out = "screenshots/new", which] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const sizes = [["computer", 1440, 900], ["phone", 390, 844]];

if (which === "old") {
  for (const [name, w, h] of sizes) {
    for (const theme of ["paper", "night"]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: "reduce", colorScheme: theme === "night" ? "dark" : "light" });
      const page = await ctx.newPage();
      await page.goto("https://mathesisstoicheion.com/read?w=tlg0059.tlg002");
      const ws = page.locator("main span[data-w]");
      await ws.nth(14).waitFor({ timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/old-reader-${name}-${theme}.png` });
      await ws.nth(14).scrollIntoViewIfNeeded();
      await ws.nth(14).click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${out}/old-look-up-${name}-${theme}.png` });
      const more = page.getByRole("button", { name: "More about it" });
      if (await more.count()) { await more.first().click(); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/old-look-up-more-${name}-${theme}.png` }); }
      await ctx.close();
    }
  }
} else {
  for (const [name, w, h] of sizes) {
    for (const theme of ["paper", "night"]) {
      for (const s of SCREENS) {
        if (theme === "night" && !["reader", "look-up", "look-up, more"].includes(s.name)) continue;
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: "reduce" });
        await prepare(ctx, { theme, columns: s.columns });
        const page = await ctx.newPage();
        await open(page, base, s);
        await page.screenshot({ path: `${out}/${s.name.replace(/[ ,]+/g, "-")}-${name}-${theme}.png` });
        await ctx.close();
      }
    }
    // the title page, the first time the book is opened
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${base}/read?w=tlg0059.tlg002`);
    await page.locator("main [role=button]").first().waitFor({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/title-page-${name}-paper.png` });
    await ctx.close();
  }
}
await browser.close();
console.log(`screenshots in ${out}`);
