/**
 * The Morpheus parser (Perseus Digital Library, Tufts University), live through the Alpheios morphology service, for a form that
 * no text in GLAUx has. Only the word is sent. Its readings are put into GLAUx's tag set, so the look-up shows them as it shows
 * GLAUx's (postag.ts).
 */
import type { Analysis } from "./words";

export const MORPHEUS = "https://morph.alpheios.net/api/v1/analysis/word";
export const MORPHEUS_HOST = "morph.alpheios.net";

const one = <T,>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const val = (x: { $?: string } | undefined) => x?.$ ?? "";

const POS: Record<string, string> = {
  noun: "n", verb: "v", "verb participle": "v", adjective: "a", adverb: "d", article: "l", particle: "g", conjunction: "c",
  preposition: "r", pronoun: "p", numeral: "m", interjection: "i", exclamation: "e", irregular: "x",
};
const PERSON: Record<string, string> = { "1st": "1", "2nd": "2", "3rd": "3" };
const NUMBER: Record<string, string> = { singular: "s", plural: "p", dual: "d" };
const TENSE: Record<string, string> = { present: "p", imperfect: "i", aorist: "a", future: "f", perfect: "r", pluperfect: "l", "future perfect": "t" };
const MOOD: Record<string, string> = { indicative: "i", subjunctive: "s", optative: "o", imperative: "m", infinitive: "n", participle: "p" };
const VOICE: Record<string, string> = { active: "a", middle: "m", passive: "p", mediopassive: "e", "middle-passive": "e" };
const GENDER: Record<string, string> = { masculine: "m", feminine: "f", neuter: "n", common: "c", "masculine feminine": "c" };
const CASE: Record<string, string> = { nominative: "n", genitive: "g", dative: "d", accusative: "a", vocative: "v", locative: "l" };
const DEGREE: Record<string, string> = { comparative: "c", superlative: "s" };

type Field = { $?: string } | undefined;
interface Infl { pofs?: Field; pers?: Field; num?: Field; tense?: Field; mood?: Field; voice?: Field; gend?: Field; case?: Field; comp?: Field }
interface Entry { dict?: { hdwd?: Field; pofs?: Field; gend?: Field }; infl?: Infl | Infl[] }

/** One of Morpheus's inflections as a GLAUx tag ("v3saia---"); a noun keeps the gender its dictionary entry gives. */
export function tagOf(infl: Infl, dict: Entry["dict"]): string {
  const pofs = val(infl.pofs) || val(dict?.pofs);
  const mood = MOOD[val(infl.mood)] ?? (pofs === "verb participle" ? "p" : "-");
  return [
    POS[pofs] ?? "x", PERSON[val(infl.pers)] ?? "-", NUMBER[val(infl.num)] ?? "-", TENSE[val(infl.tense)] ?? "-", mood,
    VOICE[val(infl.voice)] ?? "-", GENDER[val(infl.gend) || val(dict?.gend)] ?? "-", CASE[val(infl.case)] ?? "-", DEGREE[val(infl.comp)] ?? "-",
  ].join("");
}

/** Morpheus's answer as readings, its first first: the dictionary form without Morpheus's homograph number ("λέγω2"), and the tag. */
export function parseMorpheus(json: unknown): Analysis | null {
  const bodies = one((json as { RDF?: { Annotation?: { Body?: unknown } } })?.RDF?.Annotation?.Body as { rest?: { entry?: Entry } }[] | undefined);
  const readings: Analysis["others"] = [];
  for (const b of bodies) {
    const e = b?.rest?.entry;
    const lemma = val(e?.dict?.hdwd).replace(/\d+$/, "").normalize("NFC");
    if (!e || !lemma) continue;
    for (const infl of one(e.infl)) {
      const tag = tagOf(infl, e.dict);
      if (!readings.some((r) => r.lemma === lemma && r.tag === tag)) readings.push({ lemma, tag, n: 0 });
    }
  }
  if (!readings.length) return null;
  return { lemma: readings[0].lemma, tag: readings[0].tag, manual: false, where: "parser", others: readings };
}

const asked = new Map<string, Promise<Analysis | null>>();

/** Morpheus's reading of the word, or null when it has none; gives up after a few seconds, so a slow service never holds the look-up. */
export function parserReading(word: string, ms = 6000): Promise<Analysis | null> {
  const w = word.normalize("NFC");
  if (!asked.has(w)) {
    asked.set(w, (async () => {
      const res = await fetch(`${MORPHEUS}?word=${encodeURIComponent(w)}&lang=grc&engine=morpheusgrc`, { signal: AbortSignal.timeout(ms) });
      if (!res.ok) throw new Error(`the parser answered ${res.status}`);
      return parseMorpheus(await res.json());
    })().catch((e) => { asked.delete(w); throw e; }));
  }
  return asked.get(w)!;
}
