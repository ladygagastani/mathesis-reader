import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { readSyntax } from "./syntax";
import { corpus, lemmaTest, makeQuery, refOf, searchCorpus, sentenceParts, tally, checkedByHand, type Corpus, type Query } from "./constructions";

const load = (w: string): Corpus | null =>
  existsSync(`public/data/syntax/${w}.json`) && existsSync(`public/data/words/${w}.json`)
    ? corpus(w, JSON.parse(readFileSync(`public/data/words/${w}.json`, "utf8")), readSyntax(JSON.parse(readFileSync(`public/data/syntax/${w}.json`, "utf8"))))
    : null;
const q = (preset: string | null, custom: unknown = null) => { const x = makeQuery(preset, custom as never); if ("error" in x) throw new Error(x.error); return x as Query; };
const shown = (c: Corpus, m: ReturnType<typeof searchCorpus>[number]) => sentenceParts(c, m).filter((p) => p.hit).map((p) => p.t);

describe("reading what the reader typed", () => {
  it("matches accented dictionary words exactly, unaccented ones by their letters", () => {
    expect(lemmaTest("λέγω")).toMatchObject({ exact: "λέγω" });
    const t = lemmaTest("lego");
    expect("regex" in t && t.regex?.test("λεγω")).toBe(true);
    expect(lemmaTest("")).toMatchObject({ exact: null, regex: null });
  });
  it("says what is missing", () => {
    expect(makeQuery(null, { a: {}, role: "obj", b: {} })).toHaveProperty("error");
    expect(makeQuery("no-such", null)).toHaveProperty("error");
    expect(makeQuery(null, { a: { lemma: "λόγος" }, role: "any", b: {} })).not.toHaveProperty("error");
  });
});

const hdt = load("tlg0016.tlg001");
describe.runIf(hdt)("Herodotus, book 1 (checked by hand)", () => {
  const c = hdt!;
  it("finds the genitive absolute: participle and subject, both genitive", () => {
    const m = searchCorpus(c, q("gen-abs"));
    expect(m.length).toBeGreaterThan(500);
    // 1.3.2 οὕτω δὴ ἁρπάσαντος αὐτοῦ Ἑλένην…
    const x = m.find((r) => refOf(c, r.words[0]) === "1.3.2")!;
    expect(shown(c, x)).toEqual(["ἁρπάσαντος", "αὐτοῦ"]);
    expect(checkedByHand(c, x)).toBe(true);
  });
  it("finds ἄν with the optative, and ἐάν with the subjunctive", () => {
    const opt = searchCorpus(c, q("an-opt"));
    expect(shown(c, opt.find((r) => refOf(c, r.words[0]) === "1.2.1")!)).toEqual(["εἴησαν", "ἄν"]);
    const ean = searchCorpus(c, q("ean-subj"));
    expect(shown(c, ean.find((r) => refOf(c, r.words[0]) === "1.53.3")!)).toEqual(["ἢν", "στρατεύηται"]);
  });
  it("tallies what λέγω takes as its object", () => {
    const m = searchCorpus(c, q(null, { a: {}, role: "obj", b: { lemma: "λέγω" } }));
    expect(m.length).toBeGreaterThan(1000);
    expect(tally(m, "b")).toEqual([["λέγω", m.length]]);
    expect(tally(m, "a").slice(0, 2).map((r) => r[0])).toEqual(["οὗτος", "ὅδε"]);
  });
  it("looks past prepositions to the word a phrase belongs to, and keeps the preposition", () => {
    const m = searchCorpus(c, q(null, { a: { lemma: "θάλασσα" }, role: "obj", b: { lemma: "ἀφικνέομαι" } }));
    expect(m.length).toBeGreaterThan(0);
    const words = shown(c, m[0]);
    expect(words.some((w) => /^(ἐπὶ|ἐς|ἐκ|ἀπὸ|ἀπʼ|κατὰ)$/.test(w))).toBe(true);
  });
  it("gives GLAUx's references", () => {
    expect(refOf(c, 0)).toMatch(/^1\.0|^1\.1/);
  });
});

const rep = load("tlg0059.tlg030");
describe.runIf(rep)("Plato, Republic (computer analysis)", () => {
  it("spells Stephanus references in full", () => {
    expect(refOf(rep!, 0)).toBe("1.327a");
  });
  it("finds the articular infinitive", () => {
    const m = searchCorpus(rep!, q("art-inf"));
    expect(m.some((r) => shown(rep!, r).join(" ") === "τὸ κεκτῆσθαι")).toBe(true);
  });
});
