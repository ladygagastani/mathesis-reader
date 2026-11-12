import { describe, expect, it } from "vitest";
import { drawable, plainGreek } from "./wiktionary-family";

describe("an etymology line the site can draw", () => {
  it("keeps a line in Latin and Greek letters as it is", () => {
    const line = "From Proto-Indo-European *wóyde, from *weyd- (“to see”). Cognate with Latin videō and ἰδεῖν.";
    expect(drawable(line)).toBe(line);
  });
  it("keeps a cognate's transliteration in place of a script the site cannot draw", () => {
    expect(drawable("Cognate with Sanskrit वेद (véda), Armenian գիտեմ (gitem) and Latin videō."))
      .toBe("Cognate with Sanskrit véda, Armenian gitem and Latin videō.");
  });
  it("leaves out a word in another script that has no transliteration, and tidies the punctuation", () => {
    expect(drawable("Compare Gothic 𐍅𐌰𐌹𐍄, Old English wāt.")).toBe("Compare Gothic, Old English wāt.");
  });
});

describe("a Greek word as the text spells it", () => {
  it("drops Wiktionary's marks of a long or short vowel, and keeps the accents and breathings", () => {
    expect(plainGreek("ῐ̓́σμεν")).toBe("ἴσμεν");
    expect(plainGreek("ᾱ̓γαθός")).toBe("ἀγαθός");
    expect(plainGreek("λόγος")).toBe("λόγος");
  });
});
