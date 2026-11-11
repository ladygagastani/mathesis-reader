/**
 * The Word Study index (built by scripts/build-lexicon.ts from the GLAUx word packs): every form of
 * a dictionary word with its grammar, and how often it occurs in each work. Also the pure helpers
 * that turn those counts into paradigm tables and frequency by author and period.
 */
import { greekKey, shardOf } from "@/lib/search/codec";
import { readTag } from "@/lib/lookup/postag";
import { opfsRead } from "@/lib/texts/local";
import { PACKS } from "@/config/packs";

/** A dictionary form as one word: lower case, marks that are not letters or accents removed. */
export const canonLemma = (l: string) => l.normalize("NFC").toLocaleLowerCase("el").replace(/[^\p{L}\p{M}]/gu, "");

/**
 * A form as a paradigm shows it: a grave accent written as an acute (the grave only shows the
 * word's place in the sentence), and a capital at the start of a sentence lowered unless the
 * dictionary word itself is capitalised (a name).
 */
export function displayForm(form: string, lemma: string): string {
  let f = form.normalize("NFD").replace(/̀/g, "́").normalize("NFC").replace(/[’'᾽᾿]/g, "ʼ");
  const lemmaCapital = lemma !== lemma.toLocaleLowerCase("el");
  if (!lemmaCapital) f = f.toLocaleLowerCase("el");
  return f;
}

export interface LexEntry { n: number; f: [string, number, number][]; w: [number, number][] }
export interface LexMeta { works: [string, number][]; tags: string[]; lemmas: number; forms: number }

const BASE = `${PACKS}/lexicon`;
/** Where the Scroll Case saves the index for offline use (browser storage). */
export const LEXICON_DIR = "mathesis-lexicon";
let metaP: Promise<LexMeta | null> | null = null;
const shards = new Map<string, Promise<Record<string, LexEntry> | null>>();

/** From browser storage if downloaded, else from the site. */
async function json<T>(url: string): Promise<T | null> {
  const local = await opfsRead(LEXICON_DIR, decodeURIComponent(url.slice(BASE.length + 1))).catch(() => null);
  if (local) return JSON.parse(local) as T;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`the word index could not be reached (${r.status})`);
  return r.json() as Promise<T>;
}

export const loadLexMeta = () => (metaP ??= json<LexMeta>(`${BASE}/_meta.json`).catch((e) => { metaP = null; throw e; }));

/** The entry for a dictionary word: exact spelling first, else the same letters ignoring accents. */
export async function lexEntry(lemma: string): Promise<{ lemma: string; entry: LexEntry; alike: string[] } | null> {
  const c = canonLemma(lemma);
  const s = shardOf(greekKey(c));
  if (s === "_") return null;   // no Greek letters: no dictionary word
  if (!shards.has(s)) shards.set(s, json<Record<string, LexEntry>>(`${BASE}/${encodeURIComponent(s)}.json`).catch((e) => { shards.delete(s); throw e; }));
  const data = await shards.get(s)!;
  if (!data) return null;
  const k = greekKey(c);
  // other dictionary words with the same letters: shown only if they carry accents (an unaccented
  // lemma is a stray spelling in GLAUx) and occur often enough to be a real word
  const hasMarks = (x: string) => /\p{M}/u.test(x.normalize("NFD")) || greekKey(x).length === 1;
  const alike = Object.keys(data).filter((x) => greekKey(x) === k).sort((a, b) => data[b].n - data[a].n);
  const pick = data[c] ? c : alike[0];
  const others = alike.filter((x) => x !== pick && hasMarks(x) && data[x].n >= 5);
  return pick ? { lemma: pick, entry: data[pick], alike: others } : null;
}

// ------------------------------------------------------------ paradigms
export interface Cell { forms: { form: string; n: number }[] }
export interface Grid {
  title: string; rows: { label: string; key: string }[]; cols: { label: string; key: string }[]; cells: Map<string, Cell>; n: number;
  /** under 3% of the word's occurrences: rare forms, or stray automatic analyses */
  minor?: boolean;
}
export interface Paradigm { kind: "nominal" | "verb" | "list"; grids: Grid[]; loose: { form: string; tag: string; n: number }[] }

const CASES = [["n", "Nominative"], ["g", "Genitive"], ["d", "Dative"], ["a", "Accusative"], ["v", "Vocative"]] as const;
const NUMBERS = [["s", "Singular"], ["d", "Dual"], ["p", "Plural"]] as const;
const GENDERS: Record<string, string> = { m: "Masculine", f: "Feminine", n: "Neuter", c: "Common" };
const TENSES = [["p", "Present"], ["i", "Imperfect"], ["f", "Future"], ["a", "Aorist"], ["r", "Perfect"], ["l", "Pluperfect"], ["t", "Future perfect"]] as const;
const VOICES: Record<string, string> = { a: "active", m: "middle", p: "passive", e: "middle or passive" };
const MOODS = [["i", "Indicative"], ["s", "Subjunctive"], ["o", "Optative"], ["m", "Imperative"]] as const;
const PERSONS = ["1s", "2s", "3s", "1d", "2d", "3d", "1p", "2p", "3p"];
const personLabel = (k: string) => `${k[0]}${k[0] === "1" ? "st" : k[0] === "2" ? "nd" : "rd"} ${k[1] === "s" ? "sg." : k[1] === "d" ? "du." : "pl."}`;

function add(g: Grid, key: string, form: string, n: number) {
  const c = g.cells.get(key) ?? { forms: [] };
  const same = c.forms.find((x) => x.form === form);
  if (same) same.n += n; else c.forms.push({ form, n });
  c.forms.sort((a, b) => b.n - a.n);
  g.cells.set(key, c);
  g.n += n;
}
const used = <T extends { key: string }>(all: T[], g: Grid, pick: (cellKey: string) => string) => all.filter((x) => [...g.cells.keys()].some((k) => pick(k) === x.key));

/**
 * Arrange the attested forms as the tables a grammar would print: case by number (per gender) for
 * nouns, adjectives, pronouns and articles; person by mood (per tense and voice) for verbs, with
 * infinitives and participles beside them. Only forms that occur are shown; empty rows are dropped.
 */
export function buildParadigm(entry: LexEntry, tags: string[]): Paradigm {
  const tagged = entry.f.map(([form, t, n]) => ({ form, tag: tags[t] ?? "---------", n }));
  const verbs = tagged.filter((x) => x.tag[0] === "v");
  const nominal = tagged.filter((x) => "nalpm".includes(x.tag[0]) && x.tag[7] !== "-");
  const loose: Paradigm["loose"] = [];
  const grids: Grid[] = [];

  if (verbs.length >= nominal.length && verbs.length) {
    const finite = new Map<string, Grid>(), nonFinite = new Map<string, Grid>();
    for (const x of verbs) {
      const [, per, num, ten, moo, voi, gen, cas] = x.tag.split("");
      const tv = `${ten}${voi}`;
      const tvTitle = `${TENSES.find(([k]) => k === ten)?.[1] ?? "Other"} ${VOICES[voi] ?? ""}`.trim();
      if ("isom".includes(moo) && per !== "-" && num !== "-") {
        if (!finite.has(tv)) finite.set(tv, { title: tvTitle, rows: [], cols: [], cells: new Map(), n: 0 });
        add(finite.get(tv)!, `${per}${num}|${moo}`, x.form, x.n);
      } else if (moo === "n" || moo === "p") {
        if (!nonFinite.has(tv)) nonFinite.set(tv, { title: tvTitle, rows: [], cols: [], cells: new Map(), n: 0 });
        add(nonFinite.get(tv)!, moo === "n" ? "inf|" : `ptc|${cas}${num}${gen}`, x.form, x.n);
      } else loose.push(x);
    }
    const order = (k: string) => TENSES.findIndex(([t]) => t === k[0]) * 10 + "amep".indexOf(k[1]);
    for (const [tv, g] of [...finite].sort((a, b) => order(a[0]) - order(b[0]))) {
      g.rows = used(PERSONS.map((p) => ({ key: p, label: personLabel(p) })), g, (k) => k.split("|")[0]);
      g.cols = used(MOODS.map(([key, label]) => ({ key, label })), g, (k) => k.split("|")[1]);
      // infinitive and the nominative singular participles of the same tense and voice, as an extra row
      const nf = nonFinite.get(tv);
      if (nf) { for (const [k, c] of nf.cells) if (k === "inf|" || /^ptc\|ns/.test(k)) g.cells.set(`nf|${k}`, c); }
      grids.push(g);
    }
    for (const [tv, g] of nonFinite) if (!finite.has(tv)) {
      const fin: Grid = { title: g.title, rows: [], cols: [], cells: new Map(), n: g.n };
      for (const [k, c] of g.cells) if (k === "inf|" || /^ptc\|ns/.test(k)) fin.cells.set(`nf|${k}`, c);
      if (fin.cells.size) grids.push(fin);
    }
    grids.sort((a, b) => b.n - a.n);
    return { kind: "verb", grids: flagMinor(grids, entry.n), loose: loose.concat(nominal) };
  }

  if (nominal.length) {
    const byGender = new Map<string, Grid>();
    for (const x of tagged) {
      const [pos, , num, , , , gen, cas, deg] = x.tag.split("");
      if (!("nalpm".includes(pos) && cas !== "-" && num !== "-")) { loose.push(x); continue; }
      const gk = `${deg === "c" || deg === "s" ? deg : ""}${gen}`;
      const title = [deg === "c" ? "Comparative" : deg === "s" ? "Superlative" : "", GENDERS[gen] ?? ""].filter(Boolean).join(" ");
      if (!byGender.has(gk)) byGender.set(gk, { title, rows: [], cols: [], cells: new Map(), n: 0 });
      add(byGender.get(gk)!, `${cas}|${num}`, x.form, x.n);
    }
    const gOrder = (k: string) => (k.length > 1 ? 10 * (" cs".indexOf(k[0])) : 0) + "mfnc-".indexOf(k.slice(-1));
    for (const [, g] of [...byGender].sort((a, b) => gOrder(a[0]) - gOrder(b[0]))) {
      g.rows = used(CASES.map(([key, label]) => ({ key, label })), g, (k) => k.split("|")[0]);
      g.cols = used(NUMBERS.map(([key, label]) => ({ key, label })), g, (k) => k.split("|")[1]);
      grids.push(g);
    }
    // a noun has one gender: then the title says nothing new
    if (grids.length === 1 && tagged.every((x) => x.tag[0] === "n")) grids[0].title = "";
    return { kind: "nominal", grids: flagMinor(grids, entry.n), loose };
  }

  return { kind: "list", grids, loose: tagged };
}

const flagMinor = (grids: Grid[], total: number) => grids.map((g) => (g.n < total * 0.03 ? { ...g, minor: true } : g));

/** Everything in plain English, commonest first: for the "every form" list. */
export const formList = (entry: LexEntry, tags: string[]) =>
  entry.f.map(([form, t, n]) => ({ form, n, parsing: readTag(tags[t] ?? "") }));

// ------------------------------------------------------------ frequency
export interface Freq { label: string; key: string; n: number; words: number; rate: number }

/**
 * Occurrences grouped (by author, by period…), with the rate per 10,000 words of the group's
 * analysed text, so a large author does not win just by having written more.
 */
export function groupFreq(entry: LexEntry, meta: LexMeta, groupOf: (work: string) => { key: string; label: string } | null): Freq[] {
  const words = new Map<string, number>(), hits = new Map<string, number>(), labels = new Map<string, string>();
  meta.works.forEach(([w, n]) => {
    const g = groupOf(w);
    if (!g) return;
    words.set(g.key, (words.get(g.key) ?? 0) + n);
    labels.set(g.key, g.label);
  });
  for (const [wi, n] of entry.w) {
    const g = groupOf(meta.works[wi]?.[0]);
    if (g) hits.set(g.key, (hits.get(g.key) ?? 0) + n);
  }
  return [...words].map(([key, w]) => ({ key, label: labels.get(key)!, n: hits.get(key) ?? 0, words: w, rate: w ? ((hits.get(key) ?? 0) * 10000) / w : 0 }));
}
