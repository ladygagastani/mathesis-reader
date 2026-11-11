import type { TeiDoc } from "./types";

/**
 * Find a passage from what a reader typed: "1.33", "1 33", "17a" (a Stephanus section marked
 * inside the text), or a prefix such as "2" for the start of book 2. Returns a unit index or -1.
 */
export function findRef(doc: TeiDoc, input: string): number {
  const q = input.trim().replace(/[\s,:]+/g, ".").replace(/\.+$/, "").toLowerCase();
  if (!q) return -1;
  const key = (i: number) => doc.units[i].ref.join(".").toLowerCase();
  for (let i = 0; i < doc.units.length; i++) if (key(i) === q) return i;
  for (let i = 0; i < doc.units.length; i++) if (key(i).startsWith(q + ".")) return i;
  // markers inside the text (Stephanus sections, pages, chapters)
  for (let i = 0; i < doc.units.length; i++) {
    for (const b of doc.units[i].blocks) for (const x of b.c) {
      if (typeof x !== "string" && "m" in x && x.n && x.n.toLowerCase() === q) return i;
    }
  }
  return -1;
}

export const chunkOf = (doc: TeiDoc, unit: number) => Math.max(0, doc.chunks.findIndex((c) => unit >= c.first && unit <= c.last));
