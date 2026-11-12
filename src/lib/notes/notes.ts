/**
 * Notes (SPEC.md, "Notes and Saved"): what a note is, where in a book it stands, and how two copies of the same notes are made one.
 * Nothing here touches the page, the browser's storage or the database, so it is tested on its own (notes.test.ts).
 */

/** Where a note stands: a word, a line of verse, or a whole passage, inside the passage (unit) the reader cites as `unit`. */
export type Anchor =
  | { kind: "passage"; unit: string }
  | { kind: "line"; unit: string; line: number; lines: number }
  | { kind: "word"; unit: string; i: number; word: string };
export type AnchorKind = Anchor["kind"];

export const COLOURS = ["red", "ochre", "green", "blue"] as const;
export type Colour = (typeof COLOURS)[number];
export const COLOUR_NAMES: Record<Colour, string> = { red: "Red", ochre: "Ochre", green: "Green", blue: "Blue" };

export interface Note {
  id: string;
  /** the reader's work id ("tlg0059.tlg002", "mine:…") */
  work: string;
  /** "Plato, Apology": kept with the note, so the Saved page needs no catalogue */
  book: string;
  anchor: Anchor;
  colour: Colour;
  text: string;
  /** ms since 1970, set on every change; the later copy of a note wins */
  updated: number;
  /** a removed note is kept as a mark, so the removal reaches the other devices */
  deleted?: true;
}

const MAX_TEXT = 10_000;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown, max = 200): x is string => typeof x === "string" && x.length <= max;
const isInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

function parseAnchor(x: unknown): Anchor | null {
  if (!isObj(x) || !isStr(x.unit) || !x.unit) return null;
  if (x.kind === "passage") return { kind: "passage", unit: x.unit };
  if (x.kind === "line" && isInt(x.line) && isInt(x.lines)) return { kind: "line", unit: x.unit, line: x.line, lines: x.lines };
  if (x.kind === "word" && isInt(x.i) && isStr(x.word)) return { kind: "word", unit: x.unit, i: x.i, word: x.word };
  return null;
}

/** A note read from storage or the database, or null when it is not one (an older or a damaged copy is left out, not shown wrong). */
export function parseNote(x: unknown): Note | null {
  if (!isObj(x) || !isStr(x.id, 40) || !/^[a-z0-9-]+$/.test(x.id) || !isStr(x.work) || !isStr(x.book) || !isStr(x.text, MAX_TEXT)) return null;
  const anchor = parseAnchor(x.anchor);
  const colour = COLOURS.find((c) => c === x.colour);
  if (!anchor || !colour || !isInt(x.updated)) return null;
  return { id: x.id, work: x.work, book: x.book, anchor, colour, text: x.text, updated: x.updated, ...(x.deleted === true ? { deleted: true } : {}) };
}

export function parseNotes(x: unknown): Note[] {
  return Array.isArray(x) ? x.map(parseNote).filter((n): n is Note => n !== null) : [];
}

/** Two copies of the notes made one: for each note, the copy changed last. */
export function mergeNotes(a: Note[], b: Note[]): Note[] {
  const all = new Map<string, Note>();
  for (const n of [...a, ...b]) { const was = all.get(n.id); if (!was || n.updated > was.updated) all.set(n.id, n); }
  return [...all.values()];
}

/** The notes in `mine` the other copy lacks or holds an older version of: what to send. */
export function newerThan(mine: Note[], theirs: Note[]): Note[] {
  const at = new Map(theirs.map((n) => [n.id, n.updated]));
  return mine.filter((n) => n.updated > (at.get(n.id) ?? -1));
}

export const shown = (notes: Note[]) => notes.filter((n) => !n.deleted);

/** Where the note stands, in words: "17a", "line 1.5" (a passage that is one line), "3, line 2", "λόγος in 17a". */
export function placeName(a: Anchor): string {
  if (a.kind === "passage") return a.unit;
  if (a.kind === "line") return a.lines > 1 ? `${a.unit}, line ${a.line + 1}` : `line ${a.unit}`;
  return `${a.word} in ${a.unit}`;
}

export const KIND_NAMES: Record<AnchorKind, string> = { word: "The word", line: "The line", passage: "The passage" };

/** A new note's id: random, short, and allowed by the database's check. */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** The order the Saved page and the notes menu show: by book, then newest first. */
export const byNewest = (a: Note, b: Note) => b.updated - a.updated;
