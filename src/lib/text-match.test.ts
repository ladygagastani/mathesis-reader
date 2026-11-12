import { describe, expect, it } from "vitest";
import { matchRanges, splitMatches } from "./text-match";

describe("matching a search in a text", () => {
  it("ignores accents, breathings and capitals, and gives the original's places", () => {
    expect(matchRanges("ὦ ἄνδρες Ἀθηναῖοι", "ανδρες")).toEqual([[2, 8]]);
    expect(matchRanges("Πλάτων and Plato", "πλατων")).toEqual([[0, 6]]);
    expect(matchRanges("Plato", "PLA")).toEqual([[0, 3]]);
  });
  it("finds every match, and none for an empty search", () => {
    expect(matchRanges("λόγος λόγον", "λογο")).toEqual([[0, 4], [6, 10]]);
    expect(matchRanges("λόγος", "  ")).toEqual([]);
  });
  it("folds a final sigma, so a word found in the middle is found at the end too", () => {
    expect(matchRanges("λόγος", "λογοσ")).toEqual([[0, 5]]);
  });
  it("matches a text written with separate marks (Α + ̓) as its composed form", () => {
    expect(matchRanges("Ἀπολογία", "απολ")).toEqual([[0, 4]]);
  });
});

describe("cutting a text at its matches", () => {
  it("keeps every letter, with the matches marked", () => {
    expect(splitMatches("The Apology of Socrates", "apol")).toEqual([
      { text: "The ", hit: false }, { text: "Apol", hit: true }, { text: "ogy of Socrates", hit: false },
    ]);
  });
  it("gives the whole text unmarked when nothing matches", () => {
    expect(splitMatches("Crito", "phaedo")).toEqual([{ text: "Crito", hit: false }]);
  });
});
