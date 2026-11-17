/**
 * Builds the catalogue's entry for each work, so the reader can open a book without the whole catalogue (lib/catalog.ts,
 * loadWorkCatalog). The whole catalogue is 237 KB; on a slow phone it was the largest file read before the first Greek word
 * showed. A work's entry is about 1 KB.
 *
 *   node scripts/build-catalog.mjs
 *
 * Input: the catalogue of the old site (config/packs.ts, CATALOG_URL), or the file CATALOG_FILE names.
 * Output: public/catalog/<work id>.json, each a catalogue of its own with the one author and the one work:
 *   { built, collections, authors: [{ ...author, works: [work] }] }
 * and public/catalog/_meta.json, { built, works }. Run it again when the old site's catalogue changes; a work with no entry
 * here is opened from the whole catalogue, so a new work still opens before this is run.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_SITE = process.env.NEXT_PUBLIC_DATA_SITE || "https://mathesisstoicheion.com";
const OUT = join(import.meta.dirname, "..", "public", "catalog");

const catalog = process.env.CATALOG_FILE
  ? JSON.parse(readFileSync(process.env.CATALOG_FILE, "utf8"))
  : await fetch(`${DATA_SITE}/data/catalog.json`).then((r) => {
      if (!r.ok) throw new Error(`The catalogue could not be loaded (${r.status}).`);
      return r.json();
    });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let works = 0;
for (const author of catalog.authors) {
  for (const work of author.works) {
    const one = { built: catalog.built, collections: catalog.collections, authors: [{ ...author, works: [work] }] };
    writeFileSync(join(OUT, `${work.id}.json`), JSON.stringify(one));
    works++;
  }
}
writeFileSync(join(OUT, "_meta.json"), JSON.stringify({ built: catalog.built, works }, null, 2) + "\n");
console.log(`${works} works from the catalogue built ${catalog.built}, in public/catalog`);
