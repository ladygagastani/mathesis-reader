/**
 * Dickinson College Commentaries Greek Core Vocabulary (CC BY-SA 3.0): short definitions and
 * frequency ranks for the ~500 commonest words (the old site's data/core.json, from its pipeline/build_core.py).
 */
import { fold } from "@/lib/greek";
import { CORE_URL } from "@/config/packs";

export interface CoreEntry { head: string; def: string; pos: string; group: string; rank: number }
export const CORE_CREDIT = "Dickinson College Commentaries Greek Core Vocabulary (Christopher Francese et al.), CC BY-SA 3.0";

let pending: Promise<{ exact: Map<string, CoreEntry>; folded: Map<string, CoreEntry> }> | null = null;

function load() {
  pending ??= fetch(CORE_URL).then((r) => (r.ok ? r.json() : { words: {} })).then((d: { words: Record<string, CoreEntry[]> }) => {
    const exact = new Map<string, CoreEntry>(), folded = new Map<string, CoreEntry>();
    for (const [k, v] of Object.entries(d.words)) {
      exact.set(k.normalize("NFC"), v[0]);
      if (!folded.has(fold(k))) folded.set(fold(k), v[0]);
    }
    return { exact, folded };
  }).catch(() => ({ exact: new Map(), folded: new Map() }));
  return pending;
}

/** The core-vocabulary entry for a dictionary form, if it is one of the commonest words. */
export async function coreEntry(lemma: string): Promise<CoreEntry | null> {
  const { exact, folded } = await load();
  return exact.get(lemma.normalize("NFC")) ?? folded.get(fold(lemma)) ?? null;
}

/**
 * The list's full heading where it says more than the dictionary form: a noun's genitive and article ("λόγος λόγου, ὁ"), an
 * adjective's endings, a verb's principal parts. Null where it is the bare form again ("ὅτι").
 */
export function fullHeading(e: CoreEntry | null, lemma: string | null): string | null {
  if (!e?.head) return null;
  return fold(e.head) === fold(lemma ?? "") ? null : e.head;
}

/**
 * The class the list gives the word ("2nd declension", "irregular", "coordinating"), only where the list's part of speech is the
 * kind of word the look-up already names ("noun: 2nd declension" for a noun), so that a participle of λέγω is never called
 * "irregular" on the strength of its verb.
 */
export function classOf(e: CoreEntry | null, kind: string | null): string | null {
  const m = /^([^:]+):\s*(.+)$/.exec(e?.pos ?? "");
  if (!m || !kind) return null;
  const words = kind.split(/[ ,]+/), cls = m[2].trim();
  return words.includes(m[1].trim().split(" ")[0]) && !words.includes(cls) ? cls : null;
}

/** "No. 110 of the commonest words" */
export const rankLine = (rank: number) => `No. ${rank} of the commonest words`;

/** All core words, commonest first. */
export async function coreWords(): Promise<{ lemma: string; entry: CoreEntry }[]> {
  const { exact } = await load();
  return [...exact.entries()].map(([lemma, entry]) => ({ lemma, entry })).sort((a, b) => a.entry.rank - b.entry.rank);
}
