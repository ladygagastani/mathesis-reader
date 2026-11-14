import { describe, expect, it } from "vitest";
import { markAbbreviations, spellOut } from "./abbrev";

const join = (p: ReturnType<typeof markAbbreviations>) => p.map((x) => (typeof x === "string" ? x : x.abbr)).join("");
const marked = (p: ReturnType<typeof markAbbreviations>) => p.filter((x) => typeof x !== "string").map((x) => (x as { full: string }).full);

describe("markAbbreviations", () => {
  it("marks the core list's shorthand in οἶδα's line, and leaves the text as it was", () => {
    const t = "to know (pf. in pres. sense); to know how to (+infin.)";
    expect(join(markAbbreviations(t))).toBe(t);
    expect(marked(markAbbreviations(t))).toEqual(["perfect", "present", "infinitive"]);
  });
  it("marks the principal parts' heading", () => {
    const t = "οἶδα, infin. εἰδέναι, imper. ἴσθι, plupf. used as impf. ᾔδειν";
    expect(marked(markAbbreviations(t))).toEqual(["infinitive", "imperative", "pluperfect", "imperfect"]);
  });
  it("spells the shorthand out", () => {
    expect(spellOut("to know (pf. in pres. sense); to know how to (+infin.)")).toBe("to know (perfect in present sense); to know how to (+\u00a0infinitive)");
    expect(spellOut("οἶδα, infin. εἰδέναι, imper. ἴσθι")).toBe("οἶδα, infinitive εἰδέναι, imperative ἴσθι");
    expect(spellOut("impart. sap.")).toBe("impart. sap.");
  });
  it("leaves words that only end like an abbreviation alone", () => {
    expect(marked(markAbbreviations("a part. of speech; impart. sap."))).toEqual(["participle"]);
    expect(markAbbreviations("no shorthand here")).toEqual(["no shorthand here"]);
  });
});
