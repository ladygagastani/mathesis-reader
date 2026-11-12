// Page weight and load time of the reader, new against old, on the same book, measured the same way: a phone's screen (390 px),
// Lighthouse's "slow 4G" phone (1.6 Mbit/s down, 150 ms round trip, the processor slowed 4 times), an empty cache, offline helpers
// blocked, three runs each (the middle one reported). It reports what crossed the network until the first Greek word showed, by
// kind, and the time to that word; then the time and bytes until the first look-up (the 15th word) was ready.
// usage: node scripts/weigh.mjs <new-base-url>      (the old reader is read from the live site; nothing there is changed)
import { chromium } from "playwright";

const [base = "http://localhost:3300"] = process.argv.slice(2);
const READERS = {
  new: { url: `${base}/read?w=tlg0059.tlg002`, word: "main [role=button]", ready: "[data-lookup] [aria-busy=false]" },
  old: { url: "https://mathesisstoicheion.com/read?w=tlg0059.tlg002", word: "main span[data-w]", ready: "text=you tapped" },
};
const browser = await chromium.launch();

async function run(r) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const types = new Map();
  const bytes = { all: 0, byKind: {} };
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const kind = { Script: "scripts", Stylesheet: "styles", Font: "fonts", Document: "page", Fetch: "data", XHR: "data" }[types.get(e.requestId)] ?? "other";
    bytes.all += e.encodedDataLength;
    bytes.byKind[kind] = (bytes.byKind[kind] ?? 0) + e.encodedDataLength;
  });
  const t0 = Date.now();
  await page.goto(r.url, { waitUntil: "commit" });
  await page.locator(r.word).nth(14).waitFor({ state: "visible", timeout: 180_000 });
  const firstWord = Date.now() - t0;
  const atWord = { all: bytes.all, byKind: { ...bytes.byKind } };
  await page.waitForTimeout(500);
  const t1 = Date.now();
  await page.locator(r.word).nth(14).click();
  await page.locator(r.ready).first().waitFor({ timeout: 180_000 });
  const lookup = Date.now() - t1;
  await page.waitForTimeout(1000);
  await ctx.close();
  return { firstWord, lookup, atWord, total: bytes.all };
}

const kb = (n) => `${Math.round(n / 1024)} KB`;
for (const [name, r] of Object.entries(READERS)) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await run(r));
  runs.sort((a, b) => a.firstWord - b.firstWord);
  const m = runs[1];
  console.log(`${name}: first Greek word after ${(m.firstWord / 1000).toFixed(1)} s (runs: ${runs.map((x) => (x.firstWord / 1000).toFixed(1)).join(", ")})`);
  console.log(`  by then ${kb(m.atWord.all)}: ${Object.entries(m.atWord.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${kb(v)}`).join(", ")}`);
  console.log(`  first look-up ready ${(m.lookup / 1000).toFixed(1)} s after the tap; ${kb(m.total)} in all`);
}
await browser.close();
