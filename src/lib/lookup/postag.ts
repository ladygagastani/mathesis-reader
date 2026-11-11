/**
 * Plain-English reading of an AGDT-style morphological tag, as used by GLAUx
 * (9 positions: part of speech, person, number, tense, mood, voice, gender, case, degree).
 * The values follow the GLAUx tag set (glaux-nlp, treebanks/Tagsets.py), where "b" marks a
 * coordinating word (καί, δέ, τε…).
 */
const POS: Record<string, string> = {
  n: "noun", v: "verb", a: "adjective", d: "adverb", l: "article", g: "particle", c: "conjunction",
  b: "coordinating conjunction", r: "preposition", p: "pronoun", m: "numeral", i: "interjection", e: "exclamation", x: "irregular",
};
const PERSON: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
const NUMBER: Record<string, string> = { s: "singular", p: "plural", d: "dual" };
const TENSE: Record<string, string> = { p: "present", i: "imperfect", a: "aorist", f: "future", r: "perfect", l: "pluperfect", t: "future perfect" };
const MOOD: Record<string, string> = { i: "indicative", s: "subjunctive", o: "optative", m: "imperative", n: "infinitive", p: "participle" };
const VOICE: Record<string, string> = { a: "active", m: "middle", p: "passive", e: "middle or passive" };
const GENDER: Record<string, string> = { m: "masculine", f: "feminine", n: "neuter", c: "common gender" };
const CASE: Record<string, string> = { n: "nominative", g: "genitive", d: "dative", a: "accusative", v: "vocative", l: "locative" };
const DEGREE: Record<string, string> = { c: "comparative", s: "superlative" };

export interface Parsing { pos: string; detail: string }

/** e.g. "v2spma---" → { pos: "verb", detail: "present active imperative · 2nd person singular" } */
export function readTag(tag: string): Parsing {
  const [p, per, num, ten, moo, voi, gen, cas, deg] = tag.padEnd(9, "-").split("");
  const mood = MOOD[moo];
  const pos = moo === "p" ? "participle" : moo === "n" ? "infinitive" : POS[p] ?? "word";
  let detail = "";
  if (p === "v") {
    const verb = [TENSE[ten], VOICE[voi], moo === "p" || moo === "n" ? "" : mood].filter(Boolean).join(" ");
    const who = [PERSON[per], NUMBER[num]].filter(Boolean).join(" ");
    const noun = [CASE[cas], NUMBER[num] && moo === "p" ? NUMBER[num] : "", GENDER[gen]].filter(Boolean).join(" ");
    detail = moo === "p" ? [verb, noun].filter(Boolean).join(" · ") : [verb, who].filter(Boolean).join(" · ");
  } else {
    detail = [CASE[cas], NUMBER[num], GENDER[gen], PERSON[per], DEGREE[deg]].filter(Boolean).join(" ");
  }
  return { pos, detail };
}

/** Case, number and gender, e.g. for colour-coding by case (later phases). */
export const caseOf = (tag: string) => CASE[tag[7]] ?? null;

const capital = (s: string) => s.charAt(0).toLocaleUpperCase("en") + s.slice(1);

/**
 * The kind of word, as the look-up card says it (the quiet desk, ticket 05): "noun, feminine". Only a noun carries a gender of
 * its own; an adjective or an article takes the gender of the word it goes with, so none is named for them.
 */
export function kindOf(tag: string): string {
  const { pos } = readTag(tag);
  const gender = tag[0] === "n" ? GENDER[tag[6]] : undefined;
  return gender ? `${pos}, ${gender}` : pos;
}

/**
 * The grammar of a form in plain words, with a capital to begin and no abbreviations, for the look-up card:
 * "n-s---fa-" → "Accusative singular" (a noun's gender is in its kind, kindOf), "v2spma---" → "Present active imperative,
 * 2nd person singular". A word with nothing to say (a particle, a preposition) gives "".
 */
export function plainGrammar(tag: string): string {
  const [p, per, num, ten, moo, voi, gen, cas, deg] = tag.padEnd(9, "-").split("");
  const join = (...x: (string | undefined)[]) => x.filter(Boolean).join(" ");
  // a gender is named where it belongs to the form; "common" says only that the form does not tell
  const gender = p === "n" || gen === "c" ? undefined : GENDER[gen];
  const ofNoun = join(CASE[cas], NUMBER[num], gender);
  let parts: string[];
  if (p === "v") {
    const verb = join(TENSE[ten], VOICE[voi]);
    if (moo === "p") parts = [join(verb, "participle"), ofNoun];
    else if (moo === "n") parts = [join(verb, "infinitive")];
    else parts = [join(verb, MOOD[moo]), join(PERSON[per], NUMBER[num])];
  } else parts = [join(ofNoun, DEGREE[deg]), PERSON[per] ?? ""];
  return capital(parts.filter(Boolean).join(", "));
}
