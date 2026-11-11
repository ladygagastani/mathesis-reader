import { describe, expect, it } from "vitest";
import { placeAnalyses, placedLemmaCounts, positionsFor } from "./placed";
import type { WordPack } from "./words";
import type { TeiDoc } from "@/lib/tei/types";

// A text cited by book.section, and a GLAUx pack that cites it by a page number instead (as for Aristotle).
const doc = {
  lang: "grc", levels: ["book", "section"], chunks: [{ label: "1", first: 0, last: 1 }],
  units: [
    { ref: ["1", "1"], blocks: [{ t: "p", c: ["πάντες ἄνθρωποι τοῦ εἰδέναι ὀρέγονται φύσει."] }] },
    { ref: ["1", "2"], blocks: [{ t: "p", c: ["σημεῖον δʼ ἡ τῶν αἰσθήσεων ἀγάπησις."] }] },
  ],
} as unknown as TeiDoc;
const pack: WordPack = {
  work: "x", glaux: "", sha: "", licence: "", treebank: "",
  attrs: ["page"], lemmas: ["πᾶς", "ἄνθρωπος", "ὁ", "οἶδα", "ὀρέγω", "φύσις", "σημεῖον", "δέ", "αἴσθησις", "ἀγάπησις", "."],
  // tags: 0 nominative plural adjective, 1 noun nominative plural, 2 article, 3 verb, 4 dative noun, 5 punctuation, 6 genitive plural noun
  tags: ["a-p---mn-", "n-p---mn-", "l-s---ng-", "v--pna---", "n-s---fd-", "u--------", "n-p---fg-"],
  units: [
    [["980a"], 0, "πάντες ἄνθρωποι τοῦ εἰδέναι ὀρέγονται φύσει .", [0, 1, 2, 3, 4, 5, 10], [0, 1, 2, 3, 3, 4, 5]],
    [["980a"], 1, "σημεῖον δʼ ἡ τῶν αἰσθήσεων ἀγάπησις .", [6, 7, 2, 2, 8, 9, 10], [1, 3, 2, 2, 6, 1, 5]],
  ],
};

describe("placing GLAUx's analyses on the reader's words", () => {
  it("lines them up in reading order even when the references differ", () => {
    const p = placeAnalyses(pack, doc);
    expect(p.cover).toBe(1);
    const [pantes, , , , , phusei] = positionsFor(p, "1.1", ["πάντες", "ἄνθρωποι", "τοῦ", "εἰδέναι", "ὀρέγονται", "φύσει"]);
    expect(pack.lemmas[p.lemma[pantes]]).toBe("πᾶς");
    expect(pack.tags[p.tag[phusei]]).toBe("n-s---fd-");
    const [, , , , aistheseon] = positionsFor(p, "1.2", ["σημεῖον", "δʼ", "ἡ", "τῶν", "αἰσθήσεων"]);
    expect(pack.tags[p.tag[aistheseon]]).toBe("n-p---fg-");
  });

  it("skips a word on screen that does not agree, rather than giving it another word's analysis", () => {
    const p = placeAnalyses(pack, doc);
    expect(positionsFor(p, "1.1", ["πάντες", "ἵπποι", "τοῦ"]).map((x) => x >= 0)).toEqual([true, false, true]);
    expect(positionsFor(p, "9.9", ["πάντες"])).toEqual([-1]);
  });

  it("counts the dictionary words of a page, leaving punctuation out", () => {
    const counts = placedLemmaCounts(pack, placeAnalyses(pack, doc), ["1.2"]);
    expect(counts.get("ὁ")).toBe(2);
    expect(counts.has(".")).toBe(false);
  });
});
