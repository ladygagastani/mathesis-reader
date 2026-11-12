/**
 * Builds the form index: for every word form in GLAUx (as the published word packs spell it), how GLAUx reads it across all its
 * texts — the dictionary form and the grammar tag, commonest first, with how often. The look-up reads it for a text that has no
 * word pack of its own (lib/lookup/forms.ts).
 *
 *   node scripts/build-forms.mjs [cacheDir]
 *
 * Downloads every pack listed in the packs' words/_index.json (about 345 MB; kept in cacheDir, by default the system's temp folder,
 * and checked against the index's SHA-1 so a second run downloads nothing new), then writes public/forms/<shard>.json, filed under
 * the first two letters of the folded form as LSJ's shards are (lsj.ts, shardOf), and public/forms/_meta.json.
 *
 * A shard: { l: [dictionary forms], t: [tags], f: { form: [lemma index, tag index, count, …] } }, the analyses commonest first.
 * GLAUx (Keersmaekers 2021) is CC BY-SA 4.0; so is the index.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fold } from "../src/lib/greek.ts";

const PACKS = (process.env.NEXT_PUBLIC_DATA_SITE || "https://mathesisstoicheion.com") + "/packs";
const OUT = join(import.meta.dirname, "..", "public", "forms");
const CACHE = process.argv[2] || join(tmpdir(), "mathesis-word-packs");
/** at most this many readings of a form are kept, and none seen in fewer than 1 in 50 of its uses (beyond the first) */
const KEEP = 4, SHARE = 0.02;

const shardOf = (form) => fold(form).replace(/[^α-ωϝ]/g, "").slice(0, 2) || "_";
const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

mkdirSync(CACHE, { recursive: true });
const index = JSON.parse((await get(`${PACKS}/words/_index.json`)).toString("utf8"));
const works = Object.keys(index);
console.log(`${works.length} packs; cache: ${CACHE}`);

// download what the cache lacks, a few at a time
let done = 0;
const queue = [...works];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let w; (w = queue.shift()); ) {
    const file = join(CACHE, `${w}.json`);
    if (!(existsSync(file) && sha1(readFileSync(file)) === index[w][1])) {
      const buf = await get(`${PACKS}/words/${w}.json`);
      if (sha1(buf) !== index[w][1]) throw new Error(`${w}: the download does not match the index`);
      writeFileSync(file, buf);
    }
    if (++done % 100 === 0) console.log(`  ${done} / ${works.length}`);
  }
}));

// count every form's readings: form -> "lemma\ttag" -> n
const counts = new Map();
const versions = new Set();
let tokens = 0;
for (const w of works) {
  const pack = JSON.parse(readFileSync(join(CACHE, `${w}.json`), "utf8"));
  if (pack.sha) versions.add(pack.sha);
  for (const [, , forms, lem, tag] of pack.units) {
    forms.split(" ").forEach((form, j) => {
      const t = pack.tags[tag[j]], l = pack.lemmas[lem[j]];
      // punctuation and anything without a Greek letter is not looked up
      if (!form || !t || !l || t[0] === "u" || shardOf(form) === "_") return;
      tokens++;
      const f = form.normalize("NFC");
      let m = counts.get(f);
      if (!m) counts.set(f, (m = new Map()));
      const k = `${l.normalize("NFC")}\t${t}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
  }
}
console.log(`${tokens} words, ${counts.size} forms`);

// shard, keeping each form's commonest readings
const shards = new Map();
for (const [form, m] of counts) {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const kept = [...m].sort((a, b) => b[1] - a[1]).filter(([, n], i) => i === 0 || n / total >= SHARE).slice(0, KEEP);
  const s = shardOf(form);
  let sh = shards.get(s);
  if (!sh) shards.set(s, (sh = { l: [], t: [], li: new Map(), ti: new Map(), f: {} }));
  const row = [];
  for (const [k, n] of kept) {
    const [l, t] = k.split("\t");
    if (!sh.li.has(l)) { sh.li.set(l, sh.l.length); sh.l.push(l); }
    if (!sh.ti.has(t)) { sh.ti.set(t, sh.t.length); sh.t.push(t); }
    row.push(sh.li.get(l), sh.ti.get(t), n);
  }
  sh.f[form] = row;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let bytes = 0, biggest = ["", 0];
for (const [s, sh] of [...shards].sort()) {
  const json = JSON.stringify({ l: sh.l, t: sh.t, f: sh.f });
  writeFileSync(join(OUT, `${s}.json`), json);
  bytes += json.length;
  if (json.length > biggest[1]) biggest = [s, json.length];
}
const meta = {
  source: "GLAUx (Keersmaekers 2021), through the word packs of mathesisstoicheion.com",
  licence: "CC BY-SA 4.0",
  glaux: [...versions],
  packs: works.length, words: tokens, forms: counts.size, shards: shards.size,
  built: new Date().toISOString().slice(0, 10),
};
writeFileSync(join(OUT, "_meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(`${shards.size} shards, ${(bytes / 1e6).toFixed(1)} MB; the largest is ${biggest[0]} at ${(biggest[1] / 1e6).toFixed(2)} MB`);
