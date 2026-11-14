/**
 * The dictionaries' shorthand, spelled out for a reader in the first weeks (the critique of 2026-11-14: the look-up's first line
 * read "to know (pf. in pres. sense); to know how to (+infin.)"). markAbbreviations finds each abbreviation this list knows;
 * spellOut writes the full words in its place, which is what the look-up and the Saved page show. (Marking them with a dotted
 * line instead was tried first: at the meaning's 32 px the dotted lines were the loudest thing in the panel.)
 */
export const ABBREVIATIONS: Record<string, string> = {
  "pf.": "perfect", "plpf.": "pluperfect", "plupf.": "pluperfect", "pres.": "present", "impf.": "imperfect", "aor.": "aorist",
  "fut.": "future", "infin.": "infinitive", "inf.": "infinitive", "imper.": "imperative", "imperat.": "imperative",
  "subj.": "subjunctive", "opt.": "optative", "part.": "participle", "act.": "active", "mid.": "middle", "pass.": "passive",
  "gen.": "genitive", "dat.": "dative", "acc.": "accusative", "nom.": "nominative", "voc.": "vocative",
  "sg.": "singular", "pl.": "plural", "masc.": "masculine", "fem.": "feminine", "neut.": "neuter",
  "c.": "with", "w.": "with", "esp.": "especially", "freq.": "frequently", "metaph.": "metaphorically", "Att.": "Attic", "Ep.": "Epic",
};

export type Piece = string | { abbr: string; full: string };

const KEYS = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.]/g, "\\."));
// a known abbreviation standing as a word of its own: after a start, a space or an opening sign, before anything but a letter
const FIND = new RegExp(`(?<=^|[\\s(\\[+,;])(${KEYS.join("|")})(?![\\p{L}])`, "gu");

/** The text with every known abbreviation written out: "to know (pf. in pres. sense); to know how to (+infin.)" becomes
 *  "to know (perfect in present sense); to know how to (+ infinitive)", the "+" bound to its word by a no-break space. */
export function spellOut(text: string): string {
  return markAbbreviations(text).map((p) => (typeof p === "string" ? p : p.full)).join("").replace(/\+ ?(?=\p{L})/gu, "+\u00a0");
}

/** The text cut into plain runs and marked abbreviations, in order; joined back, it is the text unchanged. */
export function markAbbreviations(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(FIND)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    out.push({ abbr: m[0], full: ABBREVIATIONS[m[0]] });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
