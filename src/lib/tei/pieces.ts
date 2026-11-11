/**
 * A run of TEI inline content as the reader draws it, exactly as the file gives it: words, the text between them, the markers
 * readers cite by (Stephanus pages and sections, chapters, verses), notes and gaps. Layout-only markers (a paragraph's, a speech's)
 * are not drawn. A page number followed straight away by its first section ("17", then "17a") is drawn once, as "17a", and at the
 * very start of a passage a marker that only repeats the number in the margin is left out, so a passage does not open with its
 * number three times.
 */
import { GREEK_WORD, isGreekWord } from "@/lib/greek";
import type { Inline } from "./types";

export type Piece =
  | { k: "w"; text: string }
  | { k: "t"; text: string }
  | { k: "mark"; kind: string; n: string }
  | { k: "note"; text: string }
  | { k: "gap" };

const SHOWN = new Set(["section", "page", "chapter", "subsection", "verse"]);
type Shown = { m: string; n: string };
const shown = (x: Inline): x is Shown => typeof x !== "string" && "m" in x && SHOWN.has(x.m) && !!x.n;

/** Does a marker say what the margin says? The margin's "17" as "17" or "17a", and "1.20.3" as "20.3" or "3". */
export function repeatsMargin(n: string, margin: string): boolean {
  const parts = margin.split(".");
  return parts.some((_, i) => { const c = parts.slice(i).join("."); return n === c || (/^\d+$/.test(c) && n === `${c}a`); });
}

/** `greek`: split the text into clickable words. `margin`: the passage's number, when this run opens the passage. */
export function pieces(c: Inline[], greek: boolean, margin?: string): Piece[] {
  const out: Piece[] = [];
  let lead = margin !== undefined;
  c.forEach((x, i) => {
    if (typeof x === "string") {
      if (x.trim()) lead = false;
      if (!greek) { if (x) out.push({ k: "t", text: x }); return; }
      for (const part of x.split(GREEK_WORD)) if (part) out.push(isGreekWord(part) ? { k: "w", text: part } : { k: "t", text: part });
      return;
    }
    if ("gap" in x) { lead = false; out.push({ k: "gap" }); return; }
    if ("note" in x) { lead = false; out.push({ k: "note", text: x.note }); return; }
    if (!shown(x)) return;
    const next = c.slice(i + 1).find((y) => (typeof y === "string" ? !!y.trim() : !("m" in y) || shown(y)));
    if (/^\d+$/.test(x.n) && next && typeof next !== "string" && shown(next) && next.n === `${x.n}a`) return;
    if (lead && repeatsMargin(x.n, margin!)) return;
    lead = false;
    out.push({ k: "mark", kind: x.m, n: x.n });
  });
  return out;
}

/** Every fifth line's number, and the first; never Perseus's line 0, which only names the first speaker. */
export const lineNo = (n?: string) => (n && /^\d+$/.test(n) && +n > 0 && (+n % 5 === 0 || n === "1") ? n : "");
