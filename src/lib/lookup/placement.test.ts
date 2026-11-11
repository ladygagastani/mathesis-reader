import { describe, expect, it } from "vitest";
import { NOTE_FROM, lookupPlace } from "./placement";

// The quiet desk, ticket 04: one rule decides where the look-up opens (docs/adr/0009-the-quiet-desk.md, decision 1)
describe("where the look-up opens", () => {
  it("is a sheet below 1100 px", () => {
    expect(lookupPlace(1099)).toBe("sheet");
    expect(lookupPlace(390)).toBe("sheet");
    expect(lookupPlace(1000)).toBe("sheet");
  });
  it("is a note in the margin at 1100 px or wider", () => {
    expect(lookupPlace(1100)).toBe("note");
    expect(lookupPlace(1440)).toBe("note");
    expect(NOTE_FROM).toBe(1100);
  });
});
