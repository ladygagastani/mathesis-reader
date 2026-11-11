import { describe, expect, it } from "vitest";
import { lookupForm, GREEK_WORD, greekKey } from "./greek";

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
