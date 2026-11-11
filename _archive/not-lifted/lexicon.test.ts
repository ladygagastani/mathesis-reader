import { describe, expect, it } from "vitest";
import { buildParadigm, displayForm, groupFreq, canonLemma, type LexEntry, type LexMeta } from "./lexicon";

describe("displayForm", () => {
  it("writes a grave as an acute and lowers a sentence-initial capital", () => {
    expect(displayForm("θεὰ", "θεά")).toBe("θεά");
    expect(displayForm("Λόγος", "λόγος")).toBe("λόγος");
  });
  it("keeps the capital of a name", () => {
    expect(displayForm("Ἀχιλῆος", "Ἀχιλλεύς")).toBe("Ἀχιλῆος");
  });
});

describe("canonLemma", () => {
  it("lowers case and drops marks that are not letters or accents", () => {
    expect(canonLemma("Εἰμί")).toBe("εἰμί");
    expect(canonLemma("·εἰμί")).toBe("εἰμί");
  });
});

const tags = ["n-s---mn-", "n-s---mg-", "n-s---ma-", "n-p---mn-", "n-s---fn-", "v1spia---", "v3spia---", "v--pna---", "v-sapamn-", "v3saia---"];

describe("buildParadigm", () => {
  it("lays out a noun by case and number, and sets a stray gender apart", () => {
    const e: LexEntry = { n: 206, f: [["λόγος", 0, 100], ["λόγου", 1, 50], ["λόγον", 2, 40], ["λόγοι", 3, 15], ["λόγος", 4, 1]], w: [] };
    const p = buildParadigm(e, tags);
    expect(p.kind).toBe("nominal");
    const main = p.grids.filter((g) => !g.minor);
    expect(main).toHaveLength(1);
    expect(main[0].rows.map((r) => r.key)).toEqual(["n", "g", "a"]);
    expect(main[0].cols.map((c) => c.key)).toEqual(["s", "p"]);
    expect(main[0].cells.get("a|s")?.forms[0]).toEqual({ form: "λόγον", n: 40 });
    expect(p.grids.find((g) => g.minor)?.title).toBe("Feminine");
  });

  it("lays out a verb by person and mood per tense and voice, with infinitive and participle", () => {
    const e: LexEntry = { n: 100, f: [["λύω", 5, 20], ["λύει", 6, 30], ["λύειν", 7, 25], ["λύσας", 8, 10], ["ἔλυσε", 9, 15]], w: [] };
    const p = buildParadigm(e, tags);
    expect(p.kind).toBe("verb");
    const present = p.grids.find((g) => g.title === "Present active")!;
    expect(present.rows.map((r) => r.key)).toEqual(["1s", "3s"]);
    expect(present.cols.map((c) => c.key)).toEqual(["i"]);
    expect(present.cells.get("nf|inf|")?.forms[0].form).toBe("λύειν");
    const aorist = p.grids.find((g) => g.title === "Aorist active")!;
    expect(aorist.cells.get("3s|i")?.forms[0].form).toBe("ἔλυσε");
    expect(aorist.cells.get("nf|ptc|nsm")?.forms[0].form).toBe("λύσας");
  });
});

describe("groupFreq", () => {
  it("gives counts and the rate per 10,000 words of each group", () => {
    const meta: LexMeta = { works: [["a.1", 10000], ["a.2", 30000], ["b.1", 5000]], tags: [], lemmas: 1, forms: 1 };
    const e: LexEntry = { n: 7, f: [], w: [[0, 2], [1, 3], [2, 2]] };
    const f = groupFreq(e, meta, (w) => ({ key: w.slice(0, 1), label: w.slice(0, 1).toUpperCase() }));
    expect(f.find((x) => x.key === "a")).toMatchObject({ n: 5, words: 40000, rate: 1.25 });
    expect(f.find((x) => x.key === "b")).toMatchObject({ n: 2, words: 5000, rate: 4 });
  });
});
