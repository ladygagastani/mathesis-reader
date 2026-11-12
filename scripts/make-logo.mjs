// Makes the logo's pictures from its drawing (src/components/logo.mjs). Not part of the site; run it again after changing the
// drawing, and commit the pictures:
//   src/app/favicon.ico      the tab icon, at 16, 32 and 48 pixels, on a clear ground so it sits on a light or dark tab bar
//   src/app/apple-icon.png   the icon an iPhone shows on its home screen, on the paper
// They live in src/app, not public, so that Next links them with a hash of their contents in the address: a browser that kept
// the old icon fetches the new one as soon as the picture changes.
// usage: node scripts/make-logo.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { logoSvg } from "../src/components/logo.mjs";

const app = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");
// the paper and the red of the printed page (styles/tokens.css)
const C = { paper: "#f3ece0", red: "#a3301a" };

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function draw(px, colours) {
  await page.setContent(`<body style="margin:0;background:transparent"><div id="icon" style="width:${px}px;height:${px}px">${logoSvg(px, colours)}</div></body>`);
  return page.locator("#icon").screenshot({ type: "png", omitBackground: true });
}

const tab = [];
for (const px of [16, 32, 48]) tab.push([px, await draw(px, { red: C.red, letter: C.paper })]);
const touch = await draw(180, { red: C.red, letter: C.paper, ground: C.paper });
await browser.close();

// the tab icon: one .ico file holding the three sizes as PNGs
function ico(sizes) {
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let at = head.length;
  sizes.forEach(([px, buf], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px, e); head.writeUInt8(px, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(at, e + 12); at += buf.length;
  });
  return Buffer.concat([head, ...sizes.map(([, b]) => b)]);
}
writeFileSync(join(app, "favicon.ico"), ico(tab));
writeFileSync(join(app, "apple-icon.png"), touch);
console.log("made the logo: src/app/favicon.ico (16, 32, 48 px) and src/app/apple-icon.png (180 px)");
