import { GREEK_WORD, isGreekWord } from "@/lib/greek";
import type { Unit } from "./types";

/** Greek words of a passage, in the order the reader shows them as clickable words. */
export function unitWords(u: Unit): string[] {
  const out: string[] = [];
  for (const b of u.blocks) for (const x of b.c) {
    if (typeof x !== "string") continue;
    for (const part of x.split(GREEK_WORD)) if (part && isGreekWord(part)) out.push(part);
  }
  return out;
}
