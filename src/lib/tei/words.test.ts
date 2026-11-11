import { describe, expect, it } from "vitest";
import { unitWords } from "./words";

describe("the words of a passage", () => {
  it("finds the words of a passage in reading order", () => {
    expect(unitWords({ ref: ["1"], blocks: [{ t: "l", c: ["μῆνιν ἄειδε, ", { m: "line", n: "1" }, "θεά"] }] })).toEqual(["μῆνιν", "ἄειδε", "θεά"]);
  });
});
