import { describe, expect, it } from "vitest";
import { centuries, century, commonShare, dialects, length, passes, periodOf, vocabOf, NO_FILTERS, UNDATED } from "./facts";

describe("dates", () => {
  it("names a century from GLAUx's first year of it", () => {
    expect(century(-500)).toBe("5th c. BC");
    expect(century(101)).toBe("2nd c. AD");
    expect(century(-800)).toBe("8th c. BC");
    expect(century(1101)).toBe("12th c. AD");
    expect(century(null)).toBeNull();
  });
  it("gives a span of centuries as one", () => {
    expect(centuries(-500, -301)).toBe("5th–4th c. BC");
    expect(centuries(-100, 100)).toBe("1st c. BC – 1st c. AD");
    expect(centuries(-400, -301)).toBe("4th c. BC");
  });
  it("files a work in its period, or as not dated", () => {
    expect(periodOf(-800)).toBe("Archaic · 8th–6th c. BC");
    expect(periodOf(-400)).toBe("Classical · 5th–4th c. BC");
    expect(periodOf(301)).toBe("Late Antique · 4th c. AD and later");
    expect(periodOf(undefined)).toBe(UNDATED);
  });
});

describe("length and vocabulary", () => {
  it("rounds a length as a reader would say it", () => {
    expect(length(847)).toBe("850 words");
    expect(length(8_740)).toBe("8,500 words");
    expect(length(129_604)).toBe("130,000 words");
    expect(length(26)).toBeNull();
  });
  it("rates only texts of 2,000 words or more", () => {
    expect(commonShare([12_000, 834])).toBe(83);
    expect(commonShare([1_500, 900])).toBeNull();
    expect(vocabOf(83)).toBe("familiar");
    expect(vocabOf(72)).toBe("mixed");
    expect(vocabOf(64)).toBe("rare");
    expect(vocabOf(null)).toBeNull();
  });
});

describe("the filters", () => {
  const meta = { a: { genre: "Epic poetry", dialect: "Ionic/Epic", from: -800, to: -701 }, b: { genre: "Oratory", dialect: "Attic", from: -400, to: -301 }, c: { genre: null } };
  const diff: Record<string, [number, number]> = { a: [100_000, 760], b: [20_000, 850] };
  it("keeps everything with none on", () => {
    expect(["a", "b", "c"].filter((id) => passes(id, NO_FILTERS, meta, diff))).toEqual(["a", "b", "c"]);
  });
  it("keeps a period, a dialect, a vocabulary", () => {
    expect(["a", "b", "c"].filter((id) => passes(id, { ...NO_FILTERS, period: "Classical · 5th–4th c. BC" }, meta, diff))).toEqual(["b"]);
    expect(["a", "b", "c"].filter((id) => passes(id, { ...NO_FILTERS, dialect: "Ionic/Epic" }, meta, diff))).toEqual(["a"]);
    expect(["a", "b", "c"].filter((id) => passes(id, { ...NO_FILTERS, vocab: "mixed" }, meta, diff))).toEqual(["a"]);
    expect(["a", "b", "c"].filter((id) => passes(id, { ...NO_FILTERS, period: UNDATED }, meta, diff))).toEqual(["c"]);
  });
  it("lists the dialects, commonest first", () => {
    expect(dialects({ ...meta, d: { genre: null, dialect: "Attic" } })).toEqual(["Attic", "Ionic/Epic"]);
  });
});
