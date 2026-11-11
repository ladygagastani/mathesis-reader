/**
 * Saying a meaning once (the quiet desk, ticket 06). The look-up's first layer gives one meaning line; the second layer must
 * not give it again, in LSJ's short definition.
 */
/** A meaning as a plain run of words, for comparing: no capitals, no punctuation, one space between words. */
export const sameText = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const parts = (x: string) => x.split(/[;,]/).map(sameText).filter(Boolean);

/** True when every piece of the line ("wrath", "wrath, anger") is already a piece of the meaning ("wrath, revengeful temper"). */
export function repeatsMeaning(line: string, meaning: string): boolean {
  const have = new Set(parts(meaning));
  const mine = parts(line);
  return mine.length > 0 && mine.every((p) => have.has(p));
}

/**
 * LSJ's entries that have a short definition of their own to show beside the meaning the card gives: not the one the card quotes
 * word for word, and not an entry with no short definition at all (the quiet desk, the look-up's fixes, the owner, 2026-10-30).
 * When none is left, "Dictionary · LSJ" shows the start of the entry itself instead, so that it is never an empty heading.
 */
export function otherDefinitions<T extends { s: string }>(entries: readonly T[], meaning: string | null | undefined): T[] {
  return entries.filter((e) => e.s && (!meaning || sameText(e.s) !== sameText(meaning)));
}
