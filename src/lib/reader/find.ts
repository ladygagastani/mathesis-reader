/**
 * Find in this book (docs/review-2026-11-12.md: the reader shows one page at a time, so the browser's own Find cannot search the
 * book): every passage whose text holds the search, accents, breathings and capitals ignored, with a few words either side of the
 * first match to show it in place.
 */
import { matchRanges } from "@/lib/text-match";
import type { TeiDoc, Unit } from "@/lib/tei/types";

export interface Found { unit: number; ref: string; before: string; match: string; after: string; count: number }

/** A passage's words as one line of plain text (its markers, notes and gaps left out). */
export function unitText(u: Unit): string {
  return u.blocks.flatMap((b) => b.c.filter((x): x is string => typeof x === "string")).join(" ").replace(/\s+/g, " ").trim();
}

/** Every passage that holds the search, in the book's order, at most `limit`. A search of fewer than two letters finds nothing. */
export function findInBook(doc: TeiDoc, query: string, limit = 100): Found[] {
  if (query.trim().length < 2) return [];
  const out: Found[] = [];
  for (let i = 0; i < doc.units.length && out.length < limit; i++) {
    const text = unitText(doc.units[i]);
    const hits = matchRanges(text, query);
    if (!hits.length) continue;
    const chars = [...text.normalize("NFC")];
    const [a, b] = hits[0];
    // about forty letters either side, cut at a space
    const from = a > 40 ? chars.lastIndexOf(" ", a - 40) + 1 : 0;
    const to = chars.length - b > 40 ? (chars.indexOf(" ", b + 40) + 1 || chars.length) : chars.length;
    out.push({
      unit: i, ref: doc.units[i].ref.join("."), count: hits.length,
      before: (from > 0 ? "…" : "") + chars.slice(from, a).join(""), match: chars.slice(a, b).join(""),
      after: chars.slice(b, to).join("").trimEnd() + (to < chars.length ? " …" : ""),
    });
  }
  return out;
}
