import { describe, expect, it } from "vitest";
import { encodePostings, decodePostings, packShard, unpackShard, greekKey, unitWords, type Posting } from "./codec";

describe("search index format", () => {
  it("round-trips postings, including extra fields and large numbers", () => {
    const ps: Posting[] = [
      { text: 0, unit: 5, word: 2, extra: [7] }, { text: 0, unit: 5, word: 9, extra: [300] },
      { text: 3, unit: 15000, word: 0, extra: [0] }, { text: 2815, unit: 1, word: 40000, extra: [12] },
    ];
    const bytes = new Uint8Array(encodePostings(ps, 1));
    expect(decodePostings(bytes, 0, ps.length, 1)).toEqual(ps);
  });

  it("packs and unpacks a shard", () => {
    const body = encodePostings([{ text: 1, unit: 2, word: 3, extra: [] }]);
    const { header, body: b } = unpackShard(packShard({ k: ["λογοσ"], o: [0], n: [1] }, body));
    expect(header.k).toEqual(["λογοσ"]);
    expect(decodePostings(b, header.o[0], header.n[0])).toEqual([{ text: 1, unit: 2, word: 3, extra: [] }]);
  });

  it("makes accent-free keys", () => {
    expect(greekKey("λόγος")).toBe("λογοσ");
    expect(greekKey("Ἀχιλῆος")).toBe("αχιληοσ");
    expect(greekKey("μυρίʼ")).toBe("μυρι");
    expect(greekKey("ταῖϲ")).toBe("ταισ");   // lunate sigma, as some First1K texts print it
  });

  it("finds the words of a passage in reading order", () => {
    expect(unitWords({ ref: ["1"], blocks: [{ t: "l", c: ["μῆνιν ἄειδε, ", { m: "line", n: "1" }, "θεά"] }] })).toEqual(["μῆνιν", "ἄειδε", "θεά"]);
  });
});
