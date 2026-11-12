import { describe, expect, it } from "vitest";
import { classOf, fullHeading, rankLine, type CoreEntry } from "./core";

// The look-up's lines from the core vocabulary, with entries as the list gives them (data/core.json).
const e = (head: string, pos: string): CoreEntry => ({ head, pos, def: "", group: "", rank: 1 });

describe("the core list's heading and class", () => {
  it("gives the full heading only where it says more than the dictionary form", () => {
    expect(fullHeading(e("λόγος λόγου, ὁ", "noun: 2nd declension"), "λόγος")).toBe("λόγος λόγου, ὁ");
    expect(fullHeading(e("οἶδα, infin. εἰδέναι, imper. ἴσθι, plupf. used as impf. ᾔδειν", "verb: irregular"), "οἶδα")).toMatch(/^οἶδα, infin/);
    expect(fullHeading(e("ὅτι", "conjunction: subordinating"), "ὅτι")).toBeNull();
    expect(fullHeading(null, "ὅτι")).toBeNull();
  });

  it("names the class only for the kind of word the list describes", () => {
    expect(classOf(e("λόγος λόγου, ὁ", "noun: 2nd declension"), "noun, masculine")).toBe("2nd declension");
    expect(classOf(e("λέγω", "verb: irregular"), "verb")).toBe("irregular");
    // a participle of an irregular verb is not itself "irregular"
    expect(classOf(e("λέγω", "verb: irregular"), "participle")).toBeNull();
    // never the kind's own word again
    expect(classOf(e("καί", "conjunction: coordinating"), "coordinating conjunction")).toBeNull();
    expect(classOf(e("ὑπό", "preposition"), "preposition")).toBeNull();
    expect(classOf(null, "noun")).toBeNull();
  });

  it("says how common the word is", () => {
    expect(rankLine(110)).toBe("No. 110 of the commonest words");
  });
});
