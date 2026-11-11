import { describe, expect, it } from "vitest";
import { blockWords, diffWords, lemmaOf, readingHunks, wordKey } from "./compare";

const w = (s: string) => s.split(" ");
describe("diffWords", () => {
  it("finds a changed word, an added word and a word left out", () => {
    expect(diffWords(w("a b c d"), w("a x c d"))).toEqual([{ a0: 1, a1: 2, b0: 1, b1: 2 }]);
    expect(diffWords(w("a b c"), w("a b n c"))).toEqual([{ a0: 2, a1: 2, b0: 2, b1: 3 }]);
    expect(diffWords(w("a b c"), w("a c"))).toEqual([{ a0: 1, a1: 2, b0: 1, b1: 1 }]);
    expect(diffWords(w("a b c"), w("a b c"))).toEqual([]);
  });
  it("keeps the words the two share, even when lines are reordered around them", () => {
    const h = diffWords(w("p q r s t"), w("q r p s t"));
    expect(h.reduce((n, x) => n + (x.a1 - x.a0) + (x.b1 - x.b0), 0)).toBe(2);
  });
});

describe("comparing Greek words", () => {
  it("ignores accents, breathings, capitals and punctuation unless spelling counts too", () => {
    expect(wordKey("Ἀχιλῆος", "readings")).toBe(wordKey("αχιληος", "readings"));
    expect(wordKey("ἐτελείετο", "spelling")).not.toBe(wordKey("ἐτελειετο", "spelling"));
    expect(wordKey("δ᾽", "spelling")).toBe(wordKey("δ’", "spelling"));
    // an iota written beside the vowel is the iota written beneath it
    expect(wordKey("καλῶι", "readings")).toBe(wordKey("καλῷ", "readings"));
  });
  it("counts words divided differently as the same reading, but not in spelling", () => {
    const k = (s: string, st: "readings" | "spelling") => s.split(" ").map((x) => wordKey(x, st));
    expect(readingHunks(k("οὐκέτι ἦλθε", "readings"), k("οὐκ ἔτι ἦλθε", "readings"), "readings")).toEqual([]);
    expect(readingHunks(k("οὐκέτι ἦλθε", "spelling"), k("οὐκ ἔτι ἦλθε", "spelling"), "spelling")).toHaveLength(1);
  });
  it("reads the words of a passage and writes a difference as an apparatus entry", () => {
    const a = blockWords([{ t: "l", c: ["Διὸς δ᾽ ἐτελείετο βουλή,"] }]);
    expect(a).toEqual(["Διὸς", "δ᾽", "ἐτελείετο", "βουλή"]);
    const b = ["Διὸς", "δ᾽", "ἐτελέετο", "βουλή"];
    const [h] = diffWords(a.map((x) => wordKey(x, "readings")), b.map((x) => wordKey(x, "readings")));
    expect(lemmaOf({ a, b }, h)).toEqual({ a: "ἐτελείετο", b: "ἐτελέετο" });
    expect(lemmaOf({ a, b: ["Διὸς", "δ᾽", "βουλή"] }, { a0: 2, a1: 3, b0: 2, b1: 2 })).toEqual({ a: "ἐτελείετο", b: "—" });
  });
});
