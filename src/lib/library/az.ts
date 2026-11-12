/**
 * Putting a list in alphabetical order, for the "A to Z" lists (the old app's components/library/az.ts; the owner asked for them on 2026-10-16).
 * A title is filed the way a library catalogue files it, accents ignored: a leading "The", "A" or "An" is passed over
 * ("The Trojan Women" under T for Trojan, "A True Story" under T for True, "The Deipnosophists" under D), and so are
 * leading numbers and a leading part in brackets ("1 Corinthians" under C, "(Sophonias) Commentary on the Parva
 * Naturalia" under C). The title itself is shown as it is. Titles that do not start with a Latin letter, such as Greek
 * ones, go together at the end, under "#". (The owner, 2026-10-31: the titles A to Z "starts on S and is all messed up".)
 */
import { fold } from "@/lib/greek";

/** The heading for everything that does not start with a Latin letter. */
export const AZ_OTHER = "#";

/** The words a title is filed by: accents and capitals folded away; a leading part in brackets, leading digits or
 *  marks, and a leading "the", "a" or "an" dropped. */
export const filed = (title: string) =>
  fold(title).replace(/^\s*\([^)]*\)\s*/u, "").replace(/^[^\p{L}]+/u, "").replace(/^(?:the|an?)\s+(?=\p{L})/u, "");

/** The letter a title is filed under: A to Z, or "#" when it does not start with a Latin letter. */
export function azKey(title: string): string {
  const c = filed(title).charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : AZ_OTHER;
}

/** Alphabetical order: A to Z, then "#"; within a letter, by the title (numbers by their size: "Oration 2" before "Oration 10"). */
export function compareAZ(a: string, b: string): number {
  const ka = azKey(a), kb = azKey(b);
  if (ka !== kb) return ka === AZ_OTHER ? 1 : kb === AZ_OTHER ? -1 : ka < kb ? -1 : 1;
  const opts = { sensitivity: "base", numeric: true } as const;
  return filed(a).localeCompare(filed(b), "en", opts) || fold(a).localeCompare(fold(b), "en", opts);
}

/** The items in alphabetical order, in one group for each letter that has any. `tie` orders items with the same title
 *  (the library's titles list puts them in the order of their authors). */
export function groupAZ<T extends { title: string }>(items: readonly T[], tie?: (x: T, y: T) => number): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const it of [...items].sort((x, y) => compareAZ(x.title, y.title) || (tie ? tie(x, y) : 0))) {
    const key = azKey(it.title);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(it);
    else out.push({ key, items: [it] });
  }
  return out;
}

/**
 * How closely a search names an author, for the "Best match" at the head of the library's list (Library.tsx). Give it the
 * words as `fold()` leaves them and every name the author goes by. 0: the words are a whole name; 1: they open a name;
 * 2: they open a word inside a name ("Plato" in "Pseudo-Plato"); 3: they are only somewhere inside one; -1: not a name of theirs.
 */
export function nameMatch(names: readonly (string | undefined)[], folded: string): number {
  if (!folded) return -1;
  let best = -1;
  for (const name of names) {
    if (!name) continue;
    const s = fold(name), i = s.indexOf(folded);
    const t = i < 0 ? -1 : s === folded ? 0 : i === 0 ? 1 : /[^\p{L}\p{N}]/u.test(s.charAt(i - 1)) ? 2 : 3;
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/** The one item that is plainly closer than all the rest (the lowest non-negative tier, held by it alone), or null when
 *  two are level or none match. A name that begins several others' too ("Anonymous", before "Anonymous of ...") names
 *  no one in particular, so it leads nothing either. */
export function bestMatch<T>(items: readonly T[], tier: (x: T) => number): T | null {
  let best: T | null = null, low = Infinity, level = false, starts = 0;
  for (const x of items) {
    const t = tier(x);
    if (t < 0) continue;
    if (t <= 1) starts++;
    if (t < low) { best = x; low = t; level = false; } else if (t === low) level = true;
  }
  return level || starts > 3 ? null : best;
}
