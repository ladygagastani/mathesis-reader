/**
 * Where a search matches a text, accents, breathings and capitals ignored (as lib/greek.ts `fold` ignores them), given as ranges of
 * the original text, so the original can be marked or quoted exactly as it is written.
 */
import { fold } from "@/lib/greek";

/** The text's characters (code points, composed), and for each character of the folded text the character it came from. */
function folded(text: string): { chars: string[]; flat: string; from: number[] } {
  const chars = [...text.normalize("NFC")];
  let flat = "";
  const from: number[] = [];
  chars.forEach((c, i) => { const x = fold(c); flat += x; for (let k = 0; k < x.length; k++) from.push(i); });
  return { chars, flat, from };
}

/** Every place the query matches, as [start, end) in the text's characters (`[...text.normalize("NFC")]`). */
export function matchRanges(text: string, query: string): [number, number][] {
  const q = fold(query.trim().normalize("NFC"));
  if (!q) return [];
  const { flat, from } = folded(text);
  const out: [number, number][] = [];
  for (let hit = flat.indexOf(q); hit >= 0; hit = flat.indexOf(q, hit + q.length)) out.push([from[hit], from[hit + q.length - 1] + 1]);
  return out;
}

/** The text cut into what matches and what does not, in order: for drawing it with the matches marked. */
export function splitMatches(text: string, query: string): { text: string; hit: boolean }[] {
  const chars = [...text.normalize("NFC")];
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const [a, b] of matchRanges(text, query)) {
    if (a > last) out.push({ text: chars.slice(last, a).join(""), hit: false });
    out.push({ text: chars.slice(a, b).join(""), hit: true });
    last = b;
  }
  if (last < chars.length || !out.length) out.push({ text: chars.slice(last).join(""), hit: false });
  return out;
}
