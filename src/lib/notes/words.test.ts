import { describe, expect, it } from "vitest";
import { parseNote } from "./notes";
import { byLemma, parseWord, parseWords, savedOf, type SavedWord } from "./words";

const word = (id: string, lemma: string, extra: Partial<SavedWord> = {}): SavedWord => ({
  id, type: "word", lemma, form: lemma, kind: "verb", meaning: "to know", work: "tlg0059.tlg002", book: "Plato, Apology", unit: "17", updated: 1, ...extra,
});

describe("a saved word", () => {
  it("is read back whole", () => {
    expect(parseWord(word("w-1", "οἶδα"))).toEqual(word("w-1", "οἶδα"));
    expect(parseWord({ ...word("w-1", "οἶδα"), deleted: true })?.deleted).toBe(true);
  });
  it("is not a note, and a note is not a saved word: each side passes over the other's records", () => {
    const note = { id: "n1", work: "w", book: "B", anchor: { kind: "passage", unit: "17" }, colour: "red", text: "t", updated: 1 };
    expect(parseWord(note)).toBeNull();
    expect(parseNote(word("w-1", "οἶδα"))).toBeNull();
    expect(parseWords([note, word("w-1", "οἶδα")])).toHaveLength(1);
  });
  it("leaves out a damaged copy", () => {
    expect(parseWord({ ...word("w-1", "οἶδα"), lemma: "" })).toBeNull();
    expect(parseWord({ ...word("W 1", "οἶδα") })).toBeNull();
    expect(parseWord({ ...word("w-1", "οἶδα"), updated: -1 })).toBeNull();
  });
});

describe("finding and ordering saved words", () => {
  it("finds a word by its dictionary form, accents aside, but not a removed one", () => {
    const words = [word("a", "οἶδα"), word("b", "λόγος", { deleted: true })];
    expect(savedOf(words, "οιδα")?.id).toBe("a");
    expect(savedOf(words, "λόγος")).toBeNull();
  });
  it("orders them as a Greek dictionary does", () => {
    expect([word("a", "λόγος"), word("b", "ἀνήρ"), word("c", "οἶδα")].sort(byLemma).map((w) => w.lemma)).toEqual(["ἀνήρ", "λόγος", "οἶδα"]);
  });
});
