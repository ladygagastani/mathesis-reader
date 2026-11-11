import { describe, expect, it } from "vitest";
import { kindOf, plainGrammar, readTag } from "./postag";
import fixture from "./fixtures/iliad-1-1.json";

describe("reading grammar tags", () => {
  it("verbs", () => {
    expect(readTag("v2spma---")).toEqual({ pos: "verb", detail: "present active imperative · 2nd person singular" });
    expect(readTag("v3saia---")).toEqual({ pos: "verb", detail: "aorist active indicative · 3rd person singular" });
    expect(readTag("v3siie---")).toEqual({ pos: "verb", detail: "imperfect middle or passive indicative · 3rd person singular" });
  });
  it("participles and infinitives", () => {
    expect(readTag("v-sapmfa-")).toEqual({ pos: "participle", detail: "aorist middle · accusative singular feminine" });
    expect(readTag("v--pna---")).toEqual({ pos: "infinitive", detail: "present active" });
  });
  it("nouns, adjectives and little words", () => {
    expect(readTag("n-s---fa-")).toEqual({ pos: "noun", detail: "accusative singular feminine" });
    expect(readTag("a-p---na-")).toEqual({ pos: "adjective", detail: "accusative plural neuter" });
    expect(readTag("b--------")).toEqual({ pos: "coordinating conjunction", detail: "" });
    expect(readTag("a-s---mnc")).toEqual({ pos: "adjective", detail: "nominative singular masculine comparative" });
  });
});

// The look-up card's wording (the quiet desk, ticket 05), on real tags: each row is a word of the Iliad's first book with the
// tag GLAUx gives it (fixtures/iliad-1-1.json says where from), the kind of word, and the grammar in plain words.
const REAL: [form: string, tag: string, kind: string, grammar: string][] = [
  ["μῆνιν", "n-s---fa-", "noun, feminine", "Accusative singular"],
  ["ψυχὰς", "n-p---fa-", "noun, feminine", "Accusative plural"],
  ["Πηληϊάδεω", "n-s---mg-", "noun, masculine", "Genitive singular"],
  ["βοῦς", "n-p---ca-", "noun, common gender", "Accusative plural"],
  ["θεὰ", "n-s---fv-", "noun, feminine", "Vocative singular"],
  ["κήρυκε", "n-d---mn-", "noun, masculine", "Nominative dual"],
  ["ἄειδε", "v2spma---", "verb", "Present active imperative, 2nd person singular"],
  ["ἔθηκε", "v3saia---", "verb", "Aorist active indicative, 3rd person singular"],
  ["ἐτελείετο", "v3siim---", "verb", "Imperfect middle indicative, 3rd person singular"],
  ["ἤγερθεν", "v3paip---", "verb", "Aorist passive indicative, 3rd person plural"],
  ["ἐναρίζοι", "v3spoa---", "verb", "Present active optative, 3rd person singular"],
  ["κιχείω", "v1sasa---", "verb", "Aorist active subjunctive, 1st person singular"],
  ["ἔσται", "v3sfim---", "verb", "Future middle indicative, 3rd person singular"],
  ["εἶναι", "v--pna---", "infinitive", "Present active infinitive"],
  ["ἱκέσθαι", "v--anm---", "infinitive", "Aorist middle infinitive"],
  ["κιὼν", "v-sapamn-", "participle", "Aorist active participle, nominative singular masculine"],
  ["ἁζόμενοι", "v-pppmmn-", "participle", "Present middle participle, nominative plural masculine"],
  ["τετελεσμένος", "v-srpmmn-", "participle", "Perfect middle participle, nominative singular masculine"],
  ["πολλὰς", "a-p---fa-", "adjective", "Accusative plural feminine"],
  ["σαώτερος", "a-s---mnc", "adjective", "Nominative singular masculine comparative"],
  ["μέγιστον", "a-s---nns", "adjective", "Nominative singular neuter superlative"],
  ["τὴν", "l-s---fa-", "article", "Accusative singular feminine"],
  ["ἐγὼ", "p1s---cn-", "pronoun", "Nominative singular, 1st person"],
  ["ὃς", "p-s---mn-", "pronoun", "Nominative singular masculine"],
  ["τινα", "p-s---ca-", "pronoun", "Accusative singular"],
  ["εἷς", "m-s---mn-", "numeral", "Nominative singular masculine"],
  ["ὕστερον", "d-------c", "adverb", "Comparative"],
  ["εὖ", "d--------", "adverb", ""],
  ["δʼ", "b--------", "coordinating conjunction", ""],
  ["ἐξ", "r--------", "preposition", ""],
  ["δὴ", "g--------", "particle", ""],
  ["οὕνεκα", "c--------", "conjunction", ""],
  ["ὦ", "i--------", "interjection", ""],
];
describe("the look-up card's wording of real tags", () => {
  it.each(REAL)("%s %s", (form, tag, kind, grammar) => {
    // the row is a real word of the Iliad with that very tag
    expect(fixture.tags.find((t) => t.tag === tag)?.form).toBe(form);
    expect(kindOf(tag)).toBe(kind);
    expect(plainGrammar(tag)).toBe(grammar);
  });
  it("covers every real tag of the sample", () => expect(REAL.map((r) => r[1]).sort()).toEqual(fixture.tags.map((t) => t.tag).sort()));
  it("writes no abbreviations, and names no gender in the kind of an adjective", () => {
    for (const [, tag] of REAL) {
      expect(plainGrammar(tag)).not.toMatch(/\b(nom|gen|dat|acc|voc|sg|pl|pres|aor|fut|perf|impf|ind|subj|opt|imp|inf|ptc|act|mid|pass|masc|fem|neut)\b\.?/i);
    }
    expect(kindOf("a-p---fa-")).toBe("adjective");
  });
});
