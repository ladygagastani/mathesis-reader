/**
 * Where else a word occurs: how many times a dictionary form stands in a work, counted from the work's word pack (GLAUx's
 * analysis of every word), the one already loaded for the look-up (the quiet desk, ticket 06). Nothing is guessed: the count is
 * the number of words the pack analyses as this dictionary form, and nothing is said when it cannot be counted.
 */
import type { WordPack } from "./words";

const counts = new WeakMap<WordPack, Map<string, number>>();

/** How many words of the work GLAUx analyses as this dictionary form (one pass over the pack, kept for the next word asked). */
export function countLemma(pack: WordPack, lemma: string): number {
  let m = counts.get(pack);
  if (!m) {
    m = new Map();
    const per = new Array<number>(pack.lemmas.length).fill(0);
    for (const u of pack.units) for (const id of u[3]) per[id]++;
    pack.lemmas.forEach((name, id) => m!.set(name, (m!.get(name) ?? 0) + per[id]));
    counts.set(pack, m);
  }
  return m.get(lemma) ?? 0;
}

/**
 * "12 times in the Apology", shown in the look-up's second layer. With no count (no analysis of the word, a work with no word
 * pack) it gives null and the line is left out, never a made-up number.
 */
export function occursLine(count: number | null | undefined, workTitle: string | null | undefined): string | null {
  if (!count || count < 1) return null;
  const times = count === 1 ? "Once" : `${count.toLocaleString("en-GB")} times`;
  return `${times} ${workTitle ? `in the ${workTitle}` : "in this work"}`;
}
