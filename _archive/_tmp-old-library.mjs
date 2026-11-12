import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
for (const [n, w, h] of [["computer", 1440, 900], ["phone", 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("https://mathesisstoicheion.com/library");
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/old-library-${n}-paper.png` });
  await p.screenshot({ path: `${out}/old-library-${n}-paper-full.png`, fullPage: true, clip: { x: 0, y: 0, width: w, height: 3000 } });
  const box = p.locator("input[type=search], input").first();
  await box.fill("plato");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/old-library-search-${n}-paper.png` });
  await ctx.close();
}
await b.close();
