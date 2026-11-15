/**
 * Builds the meaning list: a meaning for every dictionary form in the library that the core vocabulary and LSJ's short
 * definitions leave without one (ἐπειδή, φυλακή, εἴωθα…). The look-up reads it after those two (lib/lookup/meanings.ts).
 *
 *   node scripts/build-meanings.mjs
 *
 * Nothing is written by hand and nothing is composed. Each meaning is a dictionary's own words, with the dictionary named:
 *   1. the Middle Liddell's translations of the word: Liddell and Scott's Intermediate Greek-English Lexicon (1889), abridged
 *      from LSJ, which has entries the digital LSJ lacks (φυλακή, ἐγκέφαλος, ἀτυχία); the first translation of each sense;
 *   2. otherwise, Wiktionary's English glosses for the word itself (English Wiktionary, CC BY-SA 4.0, through kaikki.org's
 *      extract), from the entry of the part of speech GLAUx gives the word, where Wiktionary has one;
 *   3. otherwise, where LSJ's whole entry for the word only sends the reader to another ("ἐπειδή … v. ἐπεί"), or the Middle
 *      Liddell's does ("δίψος = δίψα"), that word's meaning, said to be under it;
 *   4. otherwise, where Wiktionary calls the word a form of another ("alternative form of …"), Wiktionary's glosses for that
 *      word, said to be under it.
 * A proper name the Middle Liddell lacks keeps Wiktionary's first line, for the look-up to say what it names (card.ts,
 * nameMeaning). A word none of these explains is left out, and the look-up says plainly that it is not in the dictionaries.
 * The translations are the dictionaries' words; only the Middle Liddell's ":—" between two senses is written "; ".
 *
 * The inputs, each read from a folder or file named by an environment variable, or downloaded (and kept) when it is not given:
 *   WORDS_DIR  the word packs (*.json), as scripts/build-forms.mjs keeps them; by default its cache in the temp folder
 *   LSJ_DIR    the LSJ shards of the data packs (<shard>.json); by default downloaded from the packs
 *   CORE_FILE  the core vocabulary (core.json); by default downloaded
 *   WIKT_FILE  kaikki.org's Ancient Greek extract of English Wiktionary (JSON lines, about 400 MB); by default downloaded
 *   ML_FILE    Perseus's XML of the Middle Liddell (text 1999.04.0058), as github.com/blinskey/middle-liddell keeps it; by
 *              default downloaded from there
 *
 * Output: public/meanings/<shard>.json, filed under the first two letters of the folded form as LSJ is, each
 *   { "<dictionary form>": { m: meaning, s: "m" (Middle Liddell) | "w" (Wiktionary) | "l" (LSJ), v?: the word it is given under }
 *                        | { n: [[part of speech, Wiktionary's lines…], …] } (a proper name) }
 * and public/meanings/_meta.json.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fold } from "../src/lib/greek.ts";

const DATA_SITE = process.env.NEXT_PUBLIC_DATA_SITE || "https://mathesisstoicheion.com";
const PACKS = `${DATA_SITE}/packs`;
const WIKT_URL = "https://kaikki.org/dictionary/Ancient%20Greek/kaikki.org-dictionary-AncientGreek.jsonl";
const OUT = join(import.meta.dirname, "..", "public", "meanings");
const CACHE = join(tmpdir(), "mathesis-meanings");
const WORDS_DIR = process.env.WORDS_DIR || join(tmpdir(), "mathesis-word-packs");
mkdirSync(CACHE, { recursive: true });

const shardOf = (form) => fold(form).replace(/[^α-ωϝ]/g, "").slice(0, 2) || "_";
const nfc = (s) => s.normalize("NFC");
const isName = (w) => /^\p{Lu}/u.test(nfc(w));
const ML_URL = "https://raw.githubusercontent.com/blinskey/middle-liddell/master/Perseus_text_1999.04.0058.xml";

/** Beta Code, as Perseus writes its dictionaries' Greek, to Greek letters (after the old site's pipeline/betacode.py) */
const LETTERS = { a: "α", b: "β", g: "γ", d: "δ", e: "ε", z: "ζ", h: "η", q: "θ", i: "ι", k: "κ", l: "λ", m: "μ", n: "ν", c: "ξ", o: "ο",
  p: "π", r: "ρ", s: "σ", t: "τ", u: "υ", f: "φ", x: "χ", y: "ψ", w: "ω", v: "ϝ" };
const MARKS = { _: "̄", "^": "̆", "+": "̈", ")": "̓", "(": "̔", "/": "́", "\\": "̀", "=": "͂", "|": "ͅ" };
const ORDER = Object.values(MARKS).join("");
const marks = (m) => [...m].map((c) => MARKS[c]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join("");
function beta(s) {
  const out = s.replace(/(\*)([_^+)(/\\=|]*)([a-zA-Z])|([a-zA-Z])(\d?)([_^+)(/\\=|]*)/g, (all, star, pre, cap, ch, num, post, at, str) => {
    if (star) return LETTERS[cap.toLowerCase()] ? LETTERS[cap.toLowerCase()].toUpperCase() + marks(pre) : all;
    const l = LETTERS[ch.toLowerCase()];
    if (!l) return all;
    if (ch.toLowerCase() === "s") {
      const next = str[at + all.length] ?? "";
      if (num === "2" || (num !== "1" && num !== "3" && !/[a-zA-Z*]/.test(next))) return "ς" + marks(post);
      return (num === "3" ? "ϲ" : "σ") + marks(post);
    }
    return l + marks(post) + num;
  });
  return out.normalize("NFC");
}

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// ---- the library's dictionary forms, with how often each is met and as what part of speech
const packs = existsSync(WORDS_DIR) ? readdirSync(WORDS_DIR).filter((f) => /^tlg.*\.json$/.test(f)) : [];
if (!packs.length) throw new Error(`no word packs in ${WORDS_DIR}: run scripts/build-forms.mjs first, or name the folder in WORDS_DIR`);
/** lemma -> { n, pos: { letter: n } } */
const lemmas = new Map();
for (const f of packs) {
  const pack = JSON.parse(readFileSync(join(WORDS_DIR, f), "utf8"));
  for (const [, , forms, lem, tag] of pack.units) {
    forms.split(" ").forEach((form, j) => {
      const t = pack.tags[tag[j]], l = pack.lemmas[lem[j]];
      // as scripts/build-forms.mjs: punctuation and anything without a Greek letter is not looked up
      if (!form || !t || !l || t[0] === "u" || shardOf(form) === "_") return;
      const k = nfc(l);
      let e = lemmas.get(k);
      if (!e) lemmas.set(k, (e = { n: 0, pos: {} }));
      e.n++;
      e.pos[t[0]] = (e.pos[t[0]] ?? 0) + 1;
    });
  }
}
console.log(`${packs.length} packs, ${lemmas.size} dictionary forms`);

// ---- the core vocabulary and LSJ, read as the look-up reads them (core.ts, lsj.ts)
const coreFile = process.env.CORE_FILE || join(CACHE, "core.json");
if (!existsSync(coreFile)) writeFileSync(coreFile, await get(`${DATA_SITE}/data/core.json`));
const coreWords = JSON.parse(readFileSync(coreFile, "utf8")).words;
const coreExact = new Set(Object.keys(coreWords).filter((k) => coreWords[k][0]?.def).map(nfc));
const coreFolded = new Set([...coreExact].map(fold));

const lsjDir = process.env.LSJ_DIR || join(CACHE, "lsj");
mkdirSync(lsjDir, { recursive: true });
const lsjShards = new Map();
async function lsjShard(s) {
  if (!lsjShards.has(s)) {
    const file = join(lsjDir, `${s}.json`);
    if (!existsSync(file) && !process.env.LSJ_DIR) {
      const buf = await get(`${PACKS}/lsj/${encodeURIComponent(s)}.json`);
      writeFileSync(file, buf ?? "{}");
    }
    lsjShards.set(s, existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  }
  return lsjShards.get(s);
}
/** LSJ's entries for a headword: the exact spelling, else the same letters ignoring accents (a name only finds a name) */
async function lsj(head) {
  const h = nfc(head), s = shardOf(h);
  if (s === "_") return null;
  const d = await lsjShard(s);
  if (d[h]) return { head: h, entries: d[h] };
  const f = fold(h);
  const key = Object.keys(d).find((k) => fold(k) === f && (!isName(h) || isName(k)));
  return key ? { head: key, entries: d[key] } : null;
}
const lsjShort = (found) => found?.entries.find((e) => e.s)?.s ?? "";

// ---- Wiktionary: per word, its entries' parts of speech, English glosses, and the words it is called a form of
const wiktFile = process.env.WIKT_FILE || join(CACHE, "wiktionary-grc.jsonl");
if (!existsSync(wiktFile)) {
  console.log("downloading Wiktionary's Ancient Greek entries (about 400 MB)…");
  writeFileSync(wiktFile, await get(WIKT_URL));
}
/** word -> [{ pos, glosses: [], of: [] }] in the order Wiktionary gives them */
const wikt = new Map();
/** a gloss that only says the word is a form or spelling of another: not a meaning */
const FORM_GLOSS = /\b(?:form|spelling|contraction|variant|inflection|participle|infinitive|comparative|superlative) of\b|^synonym of\b/i;
for await (const line of createInterface({ input: createReadStream(wiktFile, "utf8"), crlfDelay: Infinity })) {
  if (!line) continue;
  const d = JSON.parse(line);
  if (d.lang_code !== "grc" || !d.word) continue;
  const entry = { pos: d.pos, glosses: [], of: [] };
  for (const s of d.senses ?? []) {
    const tags = s.tags ?? [];
    const of = [...(s.form_of ?? []), ...(s.alt_of ?? [])].map((x) => x.word).filter(Boolean);
    if (of.length || tags.includes("form-of") || tags.includes("alt-of")) { entry.of.push(...of); continue; }
    // the sense's own gloss (a sub-sense lists its parent's first: the first is the sense this word has at the top)
    const g = s.glosses?.[0]?.trim();
    if (!g || tags.includes("no-gloss") || FORM_GLOSS.test(g)) continue;
    // with Wiktionary's note on its use where the note is short: "(with genitive) for the sake of"
    const raw = s.glosses.length === 1 ? s.raw_glosses?.[0]?.trim() : null;
    // (not where the note holds Greek and its transliteration: "(strengthened form of ἐπεί (epeí))")
    if (raw && raw.length <= 60 && raw.endsWith(g) && !/[Ͱ-Ͽἀ-῿]/u.test(raw)) { if (!entry.glosses.includes(raw)) entry.glosses.push(raw); continue; }
    if (!entry.glosses.includes(g)) entry.glosses.push(g);
  }
  if (!entry.glosses.length && !entry.of.length) continue;
  const w = nfc(d.word);
  if (!wikt.has(w)) wikt.set(w, []);
  wikt.get(w).push(entry);
}
console.log(`Wiktionary: ${wikt.size} Ancient Greek words`);

// ---- Middle Liddell (An Intermediate Greek-English Lexicon, 1889, abridged from LSJ's seventh edition), Perseus's text
const mlFile = process.env.ML_FILE || join(CACHE, "middle-liddell.xml");
if (!existsSync(mlFile)) {
  console.log("downloading the Middle Liddell (about 23 MB)…");
  writeFileSync(mlFile, await get(ML_URL));
}
/** headword -> { glosses: [the first translation of each sense], to: the word its entry only sends the reader to } */
const ml = new Map();
const mlByFold = new Map();
{
  const xml = readFileSync(mlFile, "utf8");
  const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  for (const [, key, body] of xml.matchAll(/<entry key="([^"]*)"[^>]*>([\s\S]*?)<\/entry>/g)) {
    const head = beta(key.replace(/\d+$/, ""));
    const glosses = [];
    for (const [, sense] of body.matchAll(/<sense\b[^>]*>([\s\S]*?)<\/sense>/g)) {
      // the sense's first translation, when it opens the sense: what stands before it is a label at most ("of Place,"), not a
      // phrase whose translation it would be ("οἱ ἐμοὶ εὖνοι my well-wishers")
      const at = sense.indexOf("<trans");
      if (at < 0) continue;
      const before = sense.slice(0, at);
      if (/lang="greek"/.test(before) || plain(before).length > 24) continue;
      const t = plain(/<trans\b[^>]*>([\s\S]*?)<\/trans>/.exec(sense.slice(at))[1])
        // the dictionary's ":—" parts one sense of the word from the next
        .replace(/\s*:—\s*/g, "; ").replace(/[,;:]\s*$/, "");
      // (not a translation that only leads into the Greek after it: "the office of")
      if (t && !glosses.includes(t) && !/\b(?:of|to|with|by|for|from|on|at|in|into|upon|as|a|an|the|or|and)$/i.test(t)) glosses.push(t);
    }
    // "δίψος … = δίψα": an entry with no translation of its own that gives the word as another
    const eq = !glosses.length ? /^\s*(?:<[^>]+>\s*)*=\s*<ref[^>]*lang="greek"[^>]*>([^<]+)<\/ref>/.exec(body.replace(/^[\s\S]*?<\/form>/, "").replace(/<note[\s\S]*?<\/note>|<gramGrp[\s\S]*?<\/gramGrp>/g, "").trim()) : null;
    const to = eq && /^[a-z*()/\\=|+_^]+\d?$/i.test(eq[1].trim()) ? beta(eq[1].trim().replace(/\d$/, "")) : null;
    if (!glosses.length && !to) continue;
    // a headword the dictionary has twice or more (τοί¹, τοί²) is not used: which of them the word is, nobody here knows
    if (ml.has(head)) ml.get(head).twice = true;
    else ml.set(head, { glosses, to });
    const f = fold(head);
    if (!mlByFold.has(f)) mlByFold.set(f, []);
    if (!mlByFold.get(f).includes(head)) mlByFold.get(f).push(head);
  }
}
console.log(`Middle Liddell: ${ml.size} headwords`);
/** the Middle Liddell's entry for a word: the exact spelling, else the one headword of the same letters ignoring accents */
function mlEntry(word) {
  const w = nfc(word);
  const one = (e) => (e && !e.twice ? e : null);
  if (ml.has(w)) return one(ml.get(w));
  const same = (mlByFold.get(fold(w)) ?? []).filter((k) => isName(k) === isName(w));
  return same.length === 1 ? one(ml.get(same[0])) : null;
}

/** GLAUx's first letter of a tag -> kaikki.org's part of speech */
const POS = { n: ["noun", "name"], v: ["verb"], a: ["adj"], d: ["adv"], c: ["conj"], r: ["prep", "postp"], p: ["pron", "det"],
  l: ["article", "det"], g: ["particle"], m: ["num"], i: ["intj"] };

/** Wiktionary's entries for a word: the exact spelling, else the one word of the same letters ignoring accents */
function wiktEntries(word) {
  const w = nfc(word);
  if (wikt.has(w)) return wikt.get(w);
  const f = fold(w), same = [];
  for (const k of wiktKeysByFold.get(f) ?? []) if (isName(k) === isName(w)) same.push(k);
  return same.length === 1 ? wikt.get(same[0]) : null;
}
const wiktKeysByFold = new Map();
for (const k of wikt.keys()) {
  const f = fold(k);
  if (!wiktKeysByFold.has(f)) wiktKeysByFold.set(f, []);
  wiktKeysByFold.get(f).push(k);
}

/** the entries in the order to read them: those of the part of speech GLAUx gives the word first */
function inOrder(entries, letter) {
  const want = POS[letter] ?? [];
  return [...entries.filter((e) => want.includes(e.pos)), ...entries.filter((e) => !want.includes(e.pos))];
}

/**
 * A dictionary's glosses as one meaning: whole glosses, in its order, until the line is long enough. Wiktionary's quotation marks
 * around a gloss are dropped ("of him/her/it"), and so is a gloss about other Greek words with their transliterations ("neuter πολύ
 * (polú) or πολλά (pollá) as substantive") where another gloss is the meaning.
 */
function asMeaning(glosses) {
  const greek = /[Ͱ-Ͽἀ-῿]/u;
  const plain = glosses.filter((g) => !greek.test(g));
  let out = "";
  for (const g of plain.length ? plain : glosses) {
    const t = g.replace(/\s+/g, " ").replace(/"/g, "").replace(/\.$/, "").trim();
    if (!t) continue;
    if (out && out.length + t.length > 70) break;
    out = out ? `${out}; ${t}` : t;
  }
  return out;
}

// ---- the list
const out = new Map();
const KINDS = ["core", "lsj", "ml", "name", "wikt", "lsjUnder", "mlUnder", "wiktUnder", "none"];
const tally = Object.fromEntries(KINDS.map((k) => [k, 0])), weigh = Object.fromEntries(KINDS.map((k) => [k, 0]));
const left = [];
for (const [lemma, { n, pos }] of lemmas) {
  const count = (k) => { tally[k]++; weigh[k] += n; };
  if (coreExact.has(lemma) || coreFolded.has(fold(lemma))) { count("core"); continue; }
  const found = await lsj(lemma);
  if (lsjShort(found)) { count("lsj"); continue; }
  const letter = Object.entries(pos).sort((a, b) => b[1] - a[1])[0][0];
  const entries = wiktEntries(lemma) ?? [];

  // 1. the Middle Liddell's own translations of the word (a name's too: Ἀθηναῖος, "Athenian, of or from Athens")
  const mine = mlEntry(lemma);
  if (mine?.glosses.length) { out.set(lemma, { m: asMeaning(mine.glosses), s: "m" }); count("ml"); continue; }

  // a proper name: Wiktionary's first lines, for the look-up to say what it names
  if (isName(lemma)) {
    // (a spelling Wiktionary gives as another's, Μωϋσῆς for Μωυσῆς: that one's lines)
    const alt = entries.some((e) => e.glosses.length) ? [] : entries.flatMap((e) => e.of).flatMap((w) => wiktEntries(w) ?? []);
    const lines = inOrder([...entries, ...alt], "n").filter((e) => e.glosses.length).slice(0, 2)
      .map((e) => [e.pos === "name" ? "Proper noun" : e.pos, ...e.glosses.slice(0, 3)]);
    if (lines.length) { out.set(lemma, { n: lines }); count("name"); continue; }
  }

  // 2. Wiktionary's own glosses for the word
  const own = inOrder(entries, letter).find((e) => e.glosses.length);
  if (own && !isName(lemma)) { out.set(lemma, { m: asMeaning(own.glosses), s: "w" }); count("wikt"); continue; }

  // 3. LSJ's entry, or the Middle Liddell's, only sends the reader to another word, with no sense named: LSJ's short definition
  //    of that word, or else the Middle Liddell's translations of it
  const to = (found ? pointer(found.entries) : null) ?? mine?.to ?? null;
  const there = to && fold(to) !== fold(lemma) ? await lsj(to) : null;
  // only to a word LSJ has once at most: "ἕ … v. οὗ" sends the reader to the pronoun, but LSJ has three οὗ, and the meaning found
  // first, "where", is another's
  if (to && fold(to) !== fold(lemma) && (there?.entries.length ?? 0) <= 1) {
    // the Middle Liddell's translations of that word first: the first of each sense. LSJ's short definition gathers translations
    // from anywhere in the entry ("serving as an anchor" for εὐναστήρ, whose first sense is "= εὐνητήρ"), so it is taken only
    // where the word's first sense is not itself another word.
    const t = mlEntry(to);
    if (t?.glosses.length) { out.set(lemma, { m: asMeaning(t.glosses), s: "m", v: nfc(to) }); count("mlUnder"); continue; }
    const s = there?.entries[0].s;
    if (s && !pointer(there.entries) && !/^\s*(?:=|v\.)/.test(String(there.entries[0].b[1]?.[2]?.[0] ?? ""))) {
      out.set(lemma, { m: s, s: "l", v: there.head }); count("lsjUnder"); continue;
    }
  }

  // 4. Wiktionary calls it a form of another word: that word's glosses
  let under = null;
  for (const e of inOrder(entries, letter)) {
    for (const w of e.of) {
      const there = wiktEntries(w);
      const g = there && inOrder(there, letter).find((x) => x.glosses.length);
      // (the word as a reader writes it: without Wiktionary's marks of a short or long vowel, "στρατηγός" for "στρᾰτηγός")
      if (g && fold(w) !== fold(lemma)) { under = { m: asMeaning(g.glosses), s: "w", v: nfc(w.normalize("NFD").replace(/[̄̆]/g, "")) }; break; }
    }
    if (under) break;
  }
  if (under && !isName(lemma)) { out.set(lemma, under); count("wiktUnder"); continue; }

  count("none");
  left.push([n, lemma]);
}

/**
 * The word an LSJ entry sends the reader to, when that is all the entry does: its senses read "v. ἐπεί." or "= δένδρεον", with no
 * sense of that word named ("v. χάρις A. VI. 1" names one: its short definition would be the wrong meaning), and nothing else.
 */
function pointer(entries) {
  for (const e of entries) {
    const segs = e.b[1]?.[2] ?? [];
    if (segs.length < 2) continue;
    const [lead, word, next] = segs;
    if (typeof lead !== "string" || !/^\s*(?:v\.|=)\s*$/.test(lead) || typeof word !== "object" || !word.g) continue;
    // what follows the word: nothing, a full stop, or a comma before the places it is found ("= δίψα, Th. 7.87"); not a sense of
    // that word ("v. χάρις A. VI. 1", "v. εὐθύς A. 3.", "sub fin.")
    if (typeof next === "string" && !/^\s*(?:[.;:]?\s*$|,)/.test(next)) continue;
    // ("v. Θεσσαλός 11": a sense's number, set as a reference)
    if (next && typeof next === "object" && /^[\sA-Z\dIVX.]+$/.test(next.c ?? "")) continue;
    // (the first of the words it names: "v. πρόσω, πρόσωθεν, etc." for πόρρω)
    const target = word.g.trim().split(/[\s,.;:]+/)[0];
    if (/^[\p{L}\p{M}]+$/u.test(target)) return target;
  }
  return null;
}

// ---- write
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const shards = new Map();
for (const [lemma, e] of [...out].sort((a, b) => a[0].localeCompare(b[0], "el"))) {
  const s = shardOf(lemma);
  if (!shards.has(s)) shards.set(s, {});
  shards.get(s)[lemma] = e;
}
let bytes = 0;
for (const [s, d] of shards) {
  const json = JSON.stringify(d);
  writeFileSync(join(OUT, `${s}.json`), json);
  bytes += json.length;
}
const total = [...lemmas.values()].reduce((a, e) => a + e.n, 0);
const meta = {
  sources: {
    middleLiddell: "Liddell and Scott, An Intermediate Greek-English Lexicon (1889). Text provided by Perseus Digital Library, with funding from The Annenberg CPB/Project (Perseus text 1999.04.0058, through github.com/blinskey/middle-liddell, CC BY-SA 3.0 US)",
    wiktionary: "English Wiktionary (CC BY-SA 4.0), Ancient Greek entries as extracted by kaikki.org (wiktextract, Tatu Ylonen)",
    lsj: "LSJ, Perseus Digital Library (CC BY-SA), through the data packs of mathesisstoicheion.com",
  },
  licence: "CC BY-SA 4.0",
  built: new Date().toISOString().slice(0, 10),
  forms: lemmas.size, words: total, entries: out.size, shards: shards.size,
  // how the library's dictionary forms get their meaning (forms, and the words of the library they cover)
  coverage: Object.fromEntries(Object.keys(tally).map((k) => [k, { forms: tally[k], words: weigh[k] }])),
};
writeFileSync(join(OUT, "_meta.json"), JSON.stringify(meta, null, 2) + "\n");
writeFileSync(join(CACHE, "left.json"), JSON.stringify(left.sort((a, b) => b[0] - a[0])));
for (const k of Object.keys(tally)) console.log(`  ${k}: ${tally[k]} forms, ${(100 * weigh[k] / total).toFixed(2)}% of words`);
console.log(`${out.size} meanings in ${shards.size} shards, ${(bytes / 1e6).toFixed(1)} MB; what is left: ${join(CACHE, "left.json")}`);
