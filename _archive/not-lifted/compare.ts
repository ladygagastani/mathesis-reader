/**
 * Two editions of the same Greek text, compared word by word, passage by passage: where one editor
 * prints a word the other does not, or a different word. The second edition is lined up beside the first
 * the way a translation is (align.ts), so each row holds the same passage in both.
 *
 * By default words are compared as search keys (no accents, breathings, capitals or punctuation), so what
 * shows is a difference of reading: a different word, a word added or left out. "Spelling too" also counts
 * differences of accent, breathing and elision.
 */
import { GREEK_WORD, isGreekWord } from "@/lib/greek";
import { greekKey } from "@/lib/search/codec";
import { alignChunk, type Placed, type Row } from "./align";
import type { Block, TeiDoc } from "./types";

export type Strictness = "readings" | "spelling";

/** The Greek words of some blocks, in the order the reader shows them as words. */
export function blockWords(bs: Block[]): string[] {
  const out: string[] = [];
  for (const b of bs) for (const x of b.c) {
    if (typeof x !== "string") continue;
    for (const part of x.split(GREEK_WORD)) if (part && isGreekWord(part)) out.push(part);
  }
  return out;
}

/** A word as compared: for readings, its search key, with an iota written beside a long vowel at the end (-ωι, -ηι, as some
 *  editors print the dative) taken as the iota written beneath (-ῳ, -ῃ), which the key already leaves out. */
export const wordKey = (w: string, strict: Strictness) =>
  strict === "readings" ? greekKey(w).replace(/([ωη])ι$/, "$1") : w.normalize("NFC").toLowerCase().replace(/[ʼ’'᾽]/g, "’");

/** A stretch where the editions differ: words a0…a1-1 of the first against b0…b1-1 of the second (either may be empty). */
export interface Hunk { a0: number; a1: number; b0: number; b1: number }

/**
 * The differences between two lists of words, as hunks, by the longest run of words the two share in order.
 * The shared start and end are set aside first; a middle too long to compare word by word is one hunk.
 */
export function diffWords(a: string[], b: string[]): Hunk[] {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const n = ea - s, m = eb - s;
  if (!n && !m) return [];
  if (!n || !m || n * m > 2_500_000) return [{ a0: s, a1: ea, b0: s, b1: eb }];
  // lengths of the longest common runs from each point to the end
  const L = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i * (m + 1) + j] = a[s + i] === b[s + j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
  }
  const hunks: Hunk[] = [];
  let i = 0, j = 0, open: Hunk | null = null;
  const close = () => { if (open) { hunks.push(open); open = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[s + i] === b[s + j]) { close(); i++; j++; continue; }
    open ??= { a0: s + i, a1: s + i, b0: s + j, b1: s + j };
    if (j < m && (i >= n || L[i * (m + 1) + j + 1] >= L[(i + 1) * (m + 1) + j])) { j++; open.b1 = s + j; }
    else { i++; open.a1 = s + i; }
  }
  close();
  return hunks;
}

/** The hunks that are differences of reading: for readings, words only divided differently (οὐκέτι, οὐκ ἔτι) are the same. */
export function readingHunks(ka: string[], kb: string[], strict: Strictness): Hunk[] {
  const hunks = diffWords(ka, kb);
  return strict === "spelling" ? hunks : hunks.filter((h) => ka.slice(h.a0, h.a1).join("") !== kb.slice(h.b0, h.b1).join(""));
}

/** One passage (row) where the editions differ, with the words of each. */
export interface RowDiff { key: string; chunk: number; first: number; a: string[]; b: string[]; hunks: Hunk[] }

/** Every row of the whole text where the editions differ. */
export function compareAll(A: TeiDoc, placed: Placed[], strict: Strictness): RowDiff[] {
  const out: RowDiff[] = [];
  A.chunks.forEach((c, chunk) => {
    for (const r of alignChunk(A, c, placed)) {
      const d = compareRow(r, strict);
      if (d) out.push({ ...d, chunk, first: A.units.indexOf(r.greek[0]) });
    }
  });
  return out;
}

export function compareRow(r: Row, strict: Strictness): Omit<RowDiff, "chunk" | "first"> | null {
  const a = r.greek.flatMap((u) => blockWords(u.blocks)), b = blockWords(r.trans);
  if (!b.length) return null;   // nothing beside it in the other edition: not a difference of reading
  const ka = a.map((w) => wordKey(w, strict)), kb = b.map((w) => wordKey(w, strict));
  const hunks = readingHunks(ka, kb, strict);
  return hunks.length ? { key: r.key, a, b, hunks } : null;
}

/** A hunk written as an apparatus entry is: the first edition's words ] the second's ("om." when left out, "add." when added). */
export function lemmaOf(d: Pick<RowDiff, "a" | "b">, h: Hunk): { a: string; b: string } {
  return { a: d.a.slice(h.a0, h.a1).join(" ") || "—", b: d.b.slice(h.b0, h.b1).join(" ") || "—" };
}
