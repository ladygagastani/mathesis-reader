import { describe, expect, it } from "vitest";
import { DRAWER, MARGIN, SHEET_BELOW, lookupPlace, panelPlace } from "./placement";

// One rule decides where the look-up opens (DESIGN.md, decision 1): a panel from the right that never covers the Greek, or a sheet
describe("where the look-up opens", () => {
  it("is a sheet on a phone", () => {
    expect(lookupPlace(390)).toBe("sheet");
    expect(panelPlace(SHEET_BELOW - 1, 300, null)).toEqual({ place: "sheet", shift: false });
  });

  it("slides in from the right and moves the text aside where the text fits beside it", () => {
    // the Greek alone at 1440 px: a column of 56 + 672 px
    expect(panelPlace(1440, 728, null)).toEqual({ place: "drawer", shift: true });
    expect(panelPlace(728 + DRAWER + 2 * MARGIN, 728, null)).toEqual({ place: "drawer", shift: true });
  });

  it("lies over the English when Greek and English side by side leave no room, if the Greek ends clear of it", () => {
    // Both at 1440 px: the column is 1400 px wide, the Greek ends at 700
    expect(panelPlace(1440, 1400, 700)).toEqual({ place: "drawer", shift: false });
  });

  it("is a sheet where the panel would cover the Greek", () => {
    // the Greek alone at 1100 px, the column too wide to move aside
    expect(panelPlace(1100, 728, null)).toEqual({ place: "sheet", shift: false });
    // Both at 1100 px: the Greek runs under where the panel would be
    expect(panelPlace(1100, 1060, 760)).toEqual({ place: "sheet", shift: false });
  });
});
