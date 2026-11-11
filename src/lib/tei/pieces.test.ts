import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTei } from "./parse";
import { lineNo, pieces, repeatsMargin } from "./pieces";
import { unitWords } from "./words";

describe("what the reader draws of a run of text", () => {
  it("splits Greek into words and keeps every letter between them", () => {
    const p = pieces(["μῆνιν ἄειδε, θεά"], true);
    expect(p).toEqual([{ k: "w", text: "μῆνιν" }, { k: "t", text: " " }, { k: "w", text: "ἄειδε" }, { k: "t", text: ", " }, { k: "w", text: "θεά" }]);
  });

  it("leaves English as text, with any Greek in it marked as Greek but not clickable", () => {
    expect(pieces(["How you, men of Athens"], false)).toEqual([{ k: "t", text: "How you, men of Athens" }]);
    expect(pieces(["The Ἀπολογία of Socrates"], false)).toEqual([{ k: "t", text: "The " }, { k: "g", text: "Ἀπολογία" }, { k: "t", text: " of Socrates" }]);
  });

  it("draws a Stephanus page and its first section once, as the section", () => {
    const p = pieces(["λέγειν. ", { m: "page", n: "18" }, " ", { m: "section", n: "18a" }, " τὸ"], true);
    expect(p.filter((x) => x.k === "mark")).toEqual([{ k: "mark", kind: "section", n: "18a" }]);
  });

  it("leaves out a marker that only repeats the passage's number at its start, and layout-only markers", () => {
    const p = pieces([{ m: "speech", n: "1" }, { m: "page", n: "17" }, " ", { m: "section", n: "17a" }, { m: "para" }, "ὅτι ", { m: "section", n: "17b" }, " ὡς"], true, "17");
    expect(p.filter((x) => x.k === "mark")).toEqual([{ k: "mark", kind: "section", n: "17b" }]);
  });

  it("draws a letter written as a base and a mark as the one letter it is", () => {
    expect(pieces(["Ἀπολογία"], true)).toEqual([{ k: "w", text: "Ἀπολογία" }]);
  });

  it("keeps notes and gaps", () => {
    expect(pieces([{ note: "Burnet" }, { gap: true }], true)).toEqual([{ k: "note", text: "Burnet" }, { k: "gap" }]);
  });

  it("knows a margin's number in its other spellings", () => {
    expect(repeatsMargin("17a", "17")).toBe(true);
    expect(repeatsMargin("3", "1.20.3")).toBe(true);
    expect(repeatsMargin("17b", "17")).toBe(false);
  });

  it("numbers every fifth line and the first", () => {
    expect(["0", "1", "2", "5", "10", "a"].map(lineNo)).toEqual(["", "1", "", "5", "10", ""]);
  });

  it("gives the Apology's words in the order the look-up counts them", () => {
    const doc = parseTei(readFileSync("test-fixtures/tlg0059.tlg002.perseus-grc2.xml", "utf8"));
    for (const u of doc.units) {
      const drawn = u.blocks.flatMap((b) => pieces(b.c, true)).filter((x) => x.k === "w").map((x) => (x as { text: string }).text);
      expect(drawn).toEqual(unitWords(u).map((w) => w.normalize("NFC")));
    }
  });
});
