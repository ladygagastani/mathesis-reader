/**
 * When a translation numbers its passages by a different tradition from the Greek, its references are
 * rewritten into the Greek's numbering before it is lined up (lib/tei/align.ts).
 *
 * - The Psalms: the Septuagint and the Hebrew Bible number most psalms differently. The World English
 *   Bible, the English beside the Septuagint here, follows the Hebrew. Septuagint 9 = Hebrew 9–10,
 *   10–112 = 11–113, 113 = 114–115, 114–115 = 116 (verses 1–9 and 10–19), 116–145 = 117–146,
 *   146–147 = 147 (verses 1–11 and 12–20) (Wikipedia, "Psalms", Numbering; "Psalm 116"; "Psalm 147").
 *   Within a psalm the Greek often counts the heading as verse 1 (or 1–2), which English Bibles never
 *   number ("an offset of 1, sometimes even 2 verses", Wikipedia, "Psalms"): when the Greek psalm has
 *   one or two verses more than the English, the English after the first verse starts that many verses in.
 * - 2 Ezra (2 Esdras): the Greek book is Ezra (chapters 1–10) and Nehemiah (chapters 11–23) together; an
 *   English translation of Nehemiah alone is moved on ten chapters.
 */
import type { TeiDoc, Unit } from "./types";

export type Scheme = "lxx-psalms-hebrew" | "lxx-2ezra-nehemiah" | "fix-numbering";

/**
 * Translation files whose own passage numbers are wrong, checked by reading the Greek and English side by side
 * (scripts/audit-names.ts finds candidates): English passage → the Greek passage it translates.
 * - Lucian, Trial in the Court of Vowels, Harmon's English: its section 5 is the last sentence of Greek 4
 *   ("one has no right is the act of a law-breaker"), and its 6–9 translate Greek 5–8 (Cadmus and Palamedes,
 *   Tau's violence, the visit to Cybelus, tin and tar); from 10 the numbers agree again.
 */
const FIXES: Record<string, Record<string, string>> = {
  "urn:cts:greekLit:tlg0062.tlg014.perseus-eng2": { 5: "4", 6: "5", 7: "6", 8: "7", 9: "8" },
};

/** The renumbering a translation needs beside a work's Greek, if any. */
export function schemeFor(work: string, tr: { urn: string; desc?: string | null; label?: string | null }): Scheme | undefined {
  if (FIXES[tr.urn]) return "fix-numbering";
  const about = `${tr.desc ?? ""} ${tr.label ?? ""}`;
  if (work === "tlg0527.tlg027" && /World English Bible/i.test(about)) return "lxx-psalms-hebrew";
  if (work === "tlg0527.tlg018" && /Nehemiah/i.test(about)) return "lxx-2ezra-nehemiah";
  return undefined;
}

/** Septuagint psalm → the Hebrew (English) psalm and verse range it holds, in order. */
function hebrewParts(c: number): [number, number, number][] {
  const all = (h: number): [number, number, number] => [h, 1, Infinity];
  if (c <= 8 || c >= 148) return [all(c)];
  if (c === 9) return [all(9), all(10)];
  if (c <= 112) return [all(c + 1)];
  if (c === 113) return [all(114), all(115)];
  if (c === 114) return [[116, 1, 9]];
  if (c === 115) return [[116, 10, Infinity]];
  if (c <= 145) return [all(c + 1)];
  if (c === 146) return [[147, 1, 11]];
  if (c === 147) return [[147, 12, Infinity]];
  return [];
}

/** The translation with its references in the Greek's numbering (units that find no place keep theirs). */
export function renumber(scheme: Scheme, grc: TeiDoc, tr: TeiDoc, urn?: string): TeiDoc {
  if (scheme === "fix-numbering") {
    const fix = (urn && FIXES[urn]) || {};
    return { ...tr, units: tr.units.map((u) => (u.ref.length === 1 && fix[u.ref[0]] ? { ...u, ref: [fix[u.ref[0]]] } : u)) };
  }
  if (scheme === "lxx-2ezra-nehemiah") {
    return { ...tr, units: tr.units.map((u) => (/^\d+$/.test(u.ref[0]) ? { ...u, ref: [String(+u.ref[0] + 10), ...u.ref.slice(1)] } : u)) };
  }
  // the Psalms
  const greekVerses = new Map<string, string[]>();
  for (const u of grc.units) {
    if (!greekVerses.has(u.ref[0])) greekVerses.set(u.ref[0], []);
    greekVerses.get(u.ref[0])!.push(u.ref[1]);
  }
  const verses = new Map<number, Unit[]>();
  for (const u of tr.units) {
    const h = +u.ref[0];
    if (!verses.has(h)) verses.set(h, []);
    verses.get(h)!.push(u);
  }
  const moved = new Map<Unit, string[]>();
  for (const [c, gv] of greekVerses) {
    if (!/^\d+$/.test(c)) continue;
    const eng = hebrewParts(+c).flatMap(([h, a, b]) => (verses.get(h) ?? []).filter((u) => +u.ref[1] >= a && +u.ref[1] <= b));
    if (!eng.length) continue;
    const d = gv.length - eng.length;
    const shift = d >= 1 && d <= 2 ? d : 0;
    // the English first verse holds the heading too, so it starts at the Greek heading and the Greek first line
    // shares its row; the later verses are moved on by the verses of the heading
    eng.forEach((u, i) => moved.set(u, [c, gv[Math.min(i === 0 ? 0 : i + shift, gv.length - 1)]]));
  }
  // in the Greek's order, so no passage is pulled back past another
  const units = tr.units.map((u) => ({ ...u, ref: moved.get(u) ?? u.ref }));
  const pos = new Map(grc.units.map((u, i) => [u.ref.join("."), i]));
  units.sort((a, b) => (pos.get(a.ref.join(".")) ?? Infinity) - (pos.get(b.ref.join(".")) ?? Infinity));
  return { ...tr, units };
}
