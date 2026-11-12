import { describe, expect, it } from "vitest";
import type { TeiDoc } from "@/lib/tei/types";
import { findInBook, unitText } from "./find";

const doc: TeiDoc = {
  lang: "grc", levels: ["section"], chunks: [{ label: "Sections 1–3", first: 0, last: 2 }],
  units: [
    { ref: ["1"], blocks: [{ t: "p", c: ["ὅτι μὲν ὑμεῖς, ὦ ἄνδρες Ἀθηναῖοι,", { m: "section", n: "1b" }, "πεπόνθατε"] }] },
    { ref: ["2"], blocks: [{ t: "p", c: ["οὐκ οἶδα· ἐγὼ δ’ οὖν"] }] },
    { ref: ["3"], blocks: [{ t: "l", n: "3", c: ["ὦ ἄνδρες", { note: "a note" }, "ἄνδρες"] }] },
  ],
};

describe("a passage's plain text", () => {
  it("joins its words and leaves out markers and notes", () => {
    expect(unitText(doc.units[0])).toBe("ὅτι μὲν ὑμεῖς, ὦ ἄνδρες Ἀθηναῖοι, πεπόνθατε");
    expect(unitText(doc.units[2])).toBe("ὦ ἄνδρες ἄνδρες");
  });
});

describe("finding in the book", () => {
  it("lists each passage that holds the search, accents ignored, with the match and how often", () => {
    const found = findInBook(doc, "ανδρες");
    expect(found.map((f) => [f.ref, f.count])).toEqual([["1", 1], ["3", 2]]);
    expect(found[0]).toMatchObject({ unit: 0, before: "ὅτι μὲν ὑμεῖς, ὦ ", match: "ἄνδρες", after: " Ἀθηναῖοι, πεπόνθατε" });
  });
  it("finds nothing for one letter or none", () => {
    expect(findInBook(doc, "α")).toEqual([]);
    expect(findInBook(doc, " ")).toEqual([]);
  });
  it("stops at the limit", () => {
    expect(findInBook(doc, "ανδρες", 1)).toHaveLength(1);
  });
  it("cuts a long passage to the words around the match", () => {
    const long: TeiDoc = { ...doc, units: [{ ref: ["9"], blocks: [{ t: "p", c: [`${"λόγος ".repeat(20)}εὕρηκα ${"λόγος ".repeat(20)}`] }] }] };
    const [f] = findInBook(long, "ευρηκα");
    expect(f.before.startsWith("…")).toBe(true);
    expect(f.after.endsWith(" …")).toBe(true);
    expect(f.before.length).toBeLessThan(60);
  });
});
