import { describe, expect, it } from "vitest";
import { betaToGreek, detectScript, toPattern, type KeyPattern } from "./input";
import { splitRef, abbrevKey } from "./refs";
import { greekKey } from "./codec";

const pat = (w: string, s = detectScript(w)) => toPattern(w, s) as KeyPattern;
const matches = (w: string, greek: string) => pat(w).regex.test(greekKey(greek));

describe("typing Greek", () => {
  it("recognises the way it was typed", () => {
    expect(detectScript("λόγος")).toBe("greek");
    expect(detectScript("a)/nqrwpos")).toBe("beta");
    expect(detectScript("*)axilleu/s")).toBe("beta");
    expect(detectScript("anthropos")).toBe("translit");
  });

  it("reads Beta Code, capitals and accents included", () => {
    expect(betaToGreek("a)/nqrwpos")).toBe("ἄνθρωπος");
    expect(betaToGreek("*)axilleu/s")).toBe("Ἀχιλλεύς");
    expect(betaToGreek("mh=nin a)/eide qea/")).toBe("μῆνιν ἄειδε θεά");
    expect(betaToGreek("th=| o(dw=|")).toBe("τῇ ὁδῷ");
  });

  it("reads transliteration, forgiving missing long marks", () => {
    expect(matches("anthropos", "ἄνθρωπος")).toBe(true);
    expect(matches("anthrōpos", "ἄνθρωπος")).toBe(true);
    expect(matches("psyche", "ψυχή")).toBe(true);
    expect(matches("psukhe", "ψυχή")).toBe(true);
    expect(matches("hodos", "ὁδός")).toBe(true);
    expect(matches("angelos", "ἄγγελος")).toBe(true);
    expect(matches("rhetor", "ῥήτωρ")).toBe(true);
    expect(matches("logos", "λόγου")).toBe(false);
    expect(pat("anthropos").greek).toBe("ανθροπος");
  });

  it("finds the same words with or without accents", () => {
    expect(matches("λογος", "λόγος")).toBe(true);
    expect(matches("ΛΟΓΟΣ", "λόγος")).toBe(true);
    expect(matches("λόγος", "λόγοις")).toBe(false);
  });

  it("understands wildcards", () => {
    expect(matches("λογ*", "λόγοισι")).toBe(true);
    expect(matches("λ?γος", "λόγος")).toBe(true);
    expect(matches("λ?γος", "λγος")).toBe(false);
    expect(pat("λογ*").prefixes).toEqual(["λο"]);
    expect(pat("epos").prefixes).toEqual(["επ", "ηπ"]);
    expect("error" in toPattern("*ος", "greek")).toBe(true);
  });
});

describe("typed references", () => {
  it("splits a name from its reference", () => {
    expect(splitRef("Il. 1.1")).toEqual({ name: "Il.", at: "1.1" });
    expect(splitRef("S. Ant. 332")).toEqual({ name: "S. Ant.", at: "332" });
    expect(splitRef("Pl. R. 327a")).toEqual({ name: "Pl. R.", at: "327a" });
    expect(splitRef("Iliad 9 312")).toEqual({ name: "Iliad", at: "9.312" });
    expect(splitRef("Odyssey")).toEqual({ name: "Odyssey", at: null });
  });
  it("keys abbreviations the same however they are typed", () => {
    expect(abbrevKey("S. Ant.")).toBe(abbrevKey("s ant"));
  });
});
