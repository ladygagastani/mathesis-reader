/** The parsing work itself, shared by the worker (worker.ts) and the main-thread fallback (client.ts). */
import { parseTei } from "./parse";
import { placePieces, translationPieces } from "./align";
import { renumber, type Scheme } from "./versification";
import type { Placed } from "./align";
import type { TeiDoc } from "./types";

export interface ParseRequest { id: number; grc: string; tr?: string | null; scheme?: Scheme; trUrn?: string }

export function runParse({ grc, tr, scheme, trUrn }: Omit<ParseRequest, "id">): { doc: TeiDoc; placed: Placed[] | null; trLevels: string[] | null } {
  const doc = parseTei(grc);
  let placed = null, trLevels = null;
  if (tr) {
    const t0 = parseTei(tr);
    const t = scheme ? renumber(scheme, doc, t0, trUrn) : t0;
    placed = placePieces(doc, translationPieces(doc, t));
    trLevels = t.levels;
  }
  return { doc, placed, trLevels };
}
