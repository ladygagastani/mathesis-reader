/**
 * Where the word look-up opens (the quiet desk, ticket 04; docs/adr/0009-the-quiet-desk.md, decision 1): one placement per
 * device. A reader at least NOTE_FROM px wide has the look-up written as a note in the margin beside the line; a narrower
 * one has it as a low sheet from the foot of the screen. The width is the room the reader has: the window for one book,
 * the book's own box when two stand side by side or it floats in a small window.
 */
export const NOTE_FROM = 1100;
export type LookupPlace = "note" | "sheet";
export const lookupPlace = (width: number): LookupPlace => (width >= NOTE_FROM ? "note" : "sheet");
