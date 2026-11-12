/**
 * Where the word look-up opens (DESIGN.md, decision 1). On a window wide enough, it is a panel that slides in from the right edge,
 * under the bar; the note editor opens there too. The panel never covers the Greek: where the text column fits beside it, the text
 * moves aside while it is open; where it does not (Greek and English side by side), the panel lies over the English, if the Greek
 * ends clear of it. Where neither works (a phone, a narrow window), the look-up is a low sheet from the foot of the screen.
 */
export type LookupPlace = "drawer" | "sheet";

/** The panel's width, and the least room kept between it and the text, and at the window's left edge. */
export const DRAWER = 400;
export const MARGIN = 32;
/** Narrower than this, the look-up is always the sheet. */
export const SHEET_BELOW = 760;

/** A first guess from the window's width alone, before the page is measured. */
export const lookupPlace = (width: number): LookupPlace => (width >= SHEET_BELOW ? "drawer" : "sheet");

/**
 * @param width  the window's width
 * @param column  the text column's full width (rail and text), as it stands with no panel open
 * @param greekRight  with Greek and English side by side, where the Greek column ends; otherwise null
 * @returns the place, and whether the text moves aside for the panel
 */
export function panelPlace(width: number, column: number, greekRight: number | null): { place: LookupPlace; shift: boolean } {
  if (width < SHEET_BELOW) return { place: "sheet", shift: false };
  if (column + DRAWER + 2 * MARGIN <= width) return { place: "drawer", shift: true };
  if (greekRight !== null && greekRight + MARGIN <= width - DRAWER) return { place: "drawer", shift: false };
  return { place: "sheet", shift: false };
}
