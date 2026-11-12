/**
 * Where the word look-up opens (DESIGN.md, decision 1). A reader at least FLOAT_FROM px wide has it as a card floating by the
 * word, under it or over it, never on it; a narrower one (a phone) has it as a low sheet from the foot of the screen. The note
 * editor opens in the same place. The width is the room the reader has: the window for one book, the book's own box when two
 * stand side by side or it floats in a small window.
 */
export const FLOAT_FROM = 760;
export type LookupPlace = "float" | "sheet";
export const lookupPlace = (width: number): LookupPlace => (width >= FLOAT_FROM ? "float" : "sheet");

/** A box on the screen, in the window's coordinates. */
export interface Box { top: number; bottom: number; left: number; right: number }

export interface Float {
  /** the card's top left corner and width, in the window's coordinates (after `scroll`) */
  top: number; left: number; width: number;
  /** the most it may be tall: the room on its side of the word */
  maxHeight: number;
  side: "below" | "above";
  /** how far to scroll the page down first, so the card has room (0: no need) */
  scroll: number;
}

/** The card's widest, the gap between it and the word, the margin it keeps from the window's edges. */
export const FLOAT = { width: 400, gap: 10, edge: 16 };
/** A card given less room than this under the word, with more above it, opens above. */
const ENOUGH = 300;

/**
 * Where the card floats: centred on the word, inside the window; under the word if it fits there or there is room enough, else
 * over it if there is more room above; and where neither side has room enough, the page scrolls the word up under the bar first.
 * @param word  the word (or the words a note is on)
 * @param height  how tall the card would be with no limit
 * @param view  the window: its width and height, and `top`, where the room under the bar begins
 */
export function floatAt(word: Box, height: number, view: { width: number; height: number; top: number }): Float {
  const { gap, edge } = FLOAT;
  const width = Math.min(FLOAT.width, view.width - 2 * edge);
  const mid = (word.left + word.right) / 2;
  const left = Math.min(Math.max(edge, mid - width / 2), view.width - edge - width);
  let below = view.height - edge - word.bottom - gap;
  const above = word.top - gap - view.top - edge;
  let scroll = 0;
  const fits = Math.min(height, ENOUGH);
  if (below < fits && above < fits) {
    // neither side has room: bring the word up to just under the bar, and open under it
    scroll = Math.max(0, word.top - view.top - edge);
    below += scroll;
  }
  // the side is chosen for a card of full size, so a card still loading opens where the whole card will have room
  const side = below >= ENOUGH || below >= above ? "below" : "above";
  const maxHeight = Math.max(0, side === "below" ? below : above);
  const h = Math.min(height, maxHeight);
  const top = side === "below" ? word.bottom - scroll + gap : word.top - gap - h;
  return { top, left, width, maxHeight, side, scroll };
}
