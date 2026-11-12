import { describe, expect, it } from "vitest";
import { candidates, drawableGreek, lookupForm, GREEK_WORD, greekKey } from "./greek";

describe("dictionary forms to try for a printed word", () => {
  it("makes a grave acute and lowers a sentence's capital", () => {
    expect(candidates("Καὶ")).toEqual(["Καί", "καί"]);
  });
  it("tries each vowel an elided word may have lost", () => {
    expect(candidates("δʼ")).toEqual(["δα", "δε", "δο", "δι", "δά", "δέ", "δό", "δί"]);
  });
});

describe("Greek helpers", () => {
  it("turns a final grave accent into an acute for look-up", () => {
    expect(lookupForm("θεὰ")).toBe("θεά");
    expect(lookupForm("πολλὰς")).toBe("πολλάς");
    expect(lookupForm("μῆνιν")).toBe("μῆνιν");
  });
  it("drops a trailing elision mark", () => {
    expect(lookupForm("μυρίʼ")).toBe("μυρί");
  });
  it("splits a line into words and the text between them", () => {
    const parts = "οὐλομένην, ἣ μυρίʼ Ἀχαιοῖς".split(GREEK_WORD).filter(Boolean);
    expect(parts).toEqual(["οὐλομένην", ", ", "ἣ", " ", "μυρίʼ", " ", "Ἀχαιοῖς"]);
  });
  it("makes accent-free keys", () => {
    expect(greekKey("λόγος")).toBe("λογοσ");
    expect(greekKey("Ἀχιλῆος")).toBe("αχιληοσ");
    expect(greekKey("μυρίʼ")).toBe("μυρι");
    expect(greekKey("ταῖϲ")).toBe("ταισ");   // lunate sigma, as some First1K texts print it
  });

});

describe("a catalogue title the site can draw", () => {
  it("writes the numeral sign as an apostrophe and leaves out editors' brackets", () => {
    expect(drawableGreek("Ἀλκιβιάδης αʹ")).toBe("Ἀλκιβιάδης α\u2019");
    expect(drawableGreek("⟨Ἑρμοῦ⟩ ⎡περὶ νοῦ⎤")).toBe("Ἑρμοῦ περὶ νοῦ");
  });
  it("makes an inverted breve the circumflex, and leaves out marks that belong to no letter", () => {
    expect(drawableGreek("Δει\u0311πνον")).toBe("Δεῖπνον");
    expect(drawableGreek("Προτρεπτικὸς Β\u0304")).toBe("Προτρεπτικὸς Β");
    expect(drawableGreek("θεομν\u0301ηστου")).toBe("θεομνηστου");
  });
  it("keeps a title the typefaces draw as it is", () => {
    expect(drawableGreek("Ἀπολογία Σωκράτους")).toBe("Ἀπολογία Σωκράτους");
  });
});
