/**
 * Saved words (the owner, 2026-11-12: "keep save this word"): a word kept from the look-up, by its dictionary form, with the meaning
 * and kind the look-up gave and where it was first met. They live beside the notes: on the device (store.ts), and with the sync
 * code in the same database table, told apart by `type: "word"` (a note has no type; each side passes over the other's records).
 * Nothing here touches the page, the browser's storage or the database (words.test.ts).
 */
import { fold } from "@/lib/greek";

export interface SavedWord {
  id: string;
  type: "word";
  /** the dictionary form ("οἶδα") */
  lemma: string;
  /** the form as it was met in the text ("οἶδα", "ἔλεγον") */
  form: string;
  /** "verb", "noun, masculine"… or "" when the look-up had none */
  kind: string;
  /** the meaning the look-up gave, word for word */
  meaning: string;
  /** where it was met: the reader's work id, the book's name, the passage */
  work: string;
  book: string;
  unit: string;
  updated: number;
  deleted?: true;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown, max = 200): x is string => typeof x === "string" && x.length <= max;

/** A saved word read from storage or the database, or null when it is not one (a note, or a damaged copy). */
export function parseWord(x: unknown): SavedWord | null {
  if (!isObj(x) || x.type !== "word" || !isStr(x.id, 40) || !/^[a-z0-9-]+$/.test(x.id)) return null;
  if (!isStr(x.lemma) || !x.lemma || !isStr(x.form) || !isStr(x.kind) || !isStr(x.meaning, 2000) || !isStr(x.work) || !isStr(x.book) || !isStr(x.unit)) return null;
  if (!Number.isInteger(x.updated) || (x.updated as number) < 0) return null;
  return {
    id: x.id, type: "word", lemma: x.lemma, form: x.form, kind: x.kind, meaning: x.meaning, work: x.work, book: x.book, unit: x.unit,
    updated: x.updated as number, ...(x.deleted === true ? { deleted: true } : {}),
  };
}

export const parseWords = (x: unknown): SavedWord[] => (Array.isArray(x) ? x.map(parseWord).filter((w): w is SavedWord => w !== null) : []);

/** The same word, whatever its accents' case: what the look-up's Save matches on. */
export const wordKey = (lemma: string) => fold(lemma.normalize("NFC"));

/** The saved copy of a word, if it is saved (and not removed). */
export const savedOf = (words: SavedWord[], lemma: string) => words.find((w) => !w.deleted && wordKey(w.lemma) === wordKey(lemma)) ?? null;

/** The words in the order the Saved page shows them: by dictionary form, as a Greek dictionary orders them. */
export const byLemma = (a: SavedWord, b: SavedWord) => wordKey(a.lemma).localeCompare(wordKey(b.lemma), "el");
