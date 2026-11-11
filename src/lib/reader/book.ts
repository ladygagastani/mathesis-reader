/**
 * Opening a book: the work in the catalogue, its first Greek edition and its first English translation, both read from GitHub at the
 * catalogue's pinned version and parsed off the main thread, with the English placed beside the Greek passage by passage. The word
 * analyses for the work start loading at the same time, so the first look-up does not wait for them.
 */
import { greekEditions, loadCatalog, translations, type CatAuthor, type CatText, type CatWork } from "@/lib/catalog";
import { getXml } from "@/lib/texts/source";
import { parseInWorker } from "@/lib/tei/client";
import { schemeFor } from "@/lib/tei/versification";
import type { Placed } from "@/lib/tei/align";
import type { TeiDoc } from "@/lib/tei/types";
import { loadWordPack } from "@/lib/lookup/words";
import { loadSyntax } from "@/lib/syntax";

export interface Book {
  work: CatWork;
  author: CatAuthor;
  grc: CatText;
  tr: CatText | null;
  doc: TeiDoc;
  /** the English, cut and placed at the Greek passages it translates; null without a translation */
  placed: Placed[] | null;
}

export class NoSuchBook extends Error {}

export async function openBook(workId: string): Promise<Book> {
  const idx = await loadCatalog();
  const work = idx.work.get(workId);
  const author = idx.authorOf.get(workId);
  const grc = work ? greekEditions(work)[0] : undefined;
  if (!work || !author || !grc) throw new NoSuchBook(`The library has no Greek text for "${workId}".`);
  loadWordPack(work.id).catch(() => null);
  loadSyntax(work.id).catch(() => null);
  const tr = translations(work)[0] ?? null;
  const [grcXml, trXml] = await Promise.all([getXml(idx, grc), tr ? getXml(idx, tr).catch(() => null) : null]);
  const { doc, placed } = await parseInWorker(grcXml, trXml, tr ? schemeFor(work.id, tr) : undefined, tr?.urn);
  return { work, author, grc, tr: trXml ? tr : null, doc, placed };
}
