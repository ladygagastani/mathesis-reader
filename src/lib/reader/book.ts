/**
 * Opening a book: the work in the catalogue, its Greek edition and its English translation (the first of each, or the ones chosen in
 * Text: `ed` and `tr` in the address, by their version, "perseus-grc2"; tr=none for the Greek alone), both read from GitHub at the
 * catalogue's pinned version and parsed off the main thread, with the English placed beside the Greek passage by passage. The word
 * analyses for the work start loading with the texts, so the first look-up seldom waits for them. (Starting them after the texts
 * was measured on a slow phone, scripts/weigh.mjs: the Greek showed no sooner, and the first look-up was slower.)
 *
 * A private text (w=mine:<id>) comes from the database instead, only on a device that holds a sync code, and becomes a book the same way the
 * old app made one (lib/mine/mine.ts). Its words are looked up in the analyses of the work it names (its urn), if it names one.
 */
import { greekEditions, loadCatalog, translations, versionOf, type CatAuthor, type CatText, type CatWork } from "@/lib/catalog";
import { getXml } from "@/lib/texts/source";
import { parseInWorker } from "@/lib/tei/client";
import { schemeFor } from "@/lib/tei/versification";
import type { Placed } from "@/lib/tei/align";
import type { TeiDoc } from "@/lib/tei/types";
import { loadWordPack } from "@/lib/lookup/words";
import { loadSyntax } from "@/lib/syntax";
import { getPrivate, savedCode } from "@/lib/sync";
import { isMine, mineBook, mineId, mineParsed } from "@/lib/mine/mine";
import { hasPublished, workOf } from "@/lib/mine/private-translations";

export interface Book {
  work: CatWork;
  author: CatAuthor;
  grc: CatText;
  tr: CatText | null;
  doc: TeiDoc;
  /** the English, cut and placed at the Greek passages it translates; null without a translation */
  placed: Placed[] | null;
  /** the work whose word analyses the look-up reads */
  lookupWork: string;
  /** a private text: only a synced device can see it */
  private: boolean;
  /** the Greek editions and the English translations the work has, to choose from */
  editions: CatText[];
  translations: CatText[];
}

/** The edition and translation asked for, by version; undefined for the first. */
export interface Choice { ed?: string | null; tr?: string | null }

export class NoSuchBook extends Error {}
/** A private text, asked for on a device that holds no sync code. */
export class SyncFirst extends Error {}

function prefetch(work: string) {
  loadWordPack(work).catch(() => null);
  loadSyntax(work).catch(() => null);
}

export async function openBook(workId: string, choice: Choice = {}): Promise<Book> {
  if (isMine(workId)) return openPrivate(workId);
  const idx = await loadCatalog();
  const work = idx.work.get(workId);
  const author = idx.authorOf.get(workId);
  const editions = work ? greekEditions(work) : [];
  const englishes = work ? translations(work) : [];
  const grc = editions.find((t) => versionOf(t.urn) === choice.ed) ?? editions[0];
  if (!work || !author || !grc) throw new NoSuchBook(`The library has no Greek text for "${workId}".`);
  prefetch(work.id);
  const tr = choice.tr === "none" ? null : englishes.find((t) => versionOf(t.urn) === choice.tr) ?? englishes[0] ?? null;
  const [grcXml, trXml] = await Promise.all([getXml(idx, grc), tr ? getXml(idx, tr).catch(() => null) : null]);
  const { doc, placed } = await parseInWorker(grcXml, trXml, tr ? schemeFor(work.id, tr) : undefined, tr?.urn);
  return { work, author, grc, tr: trXml ? tr : null, doc, placed, lookupWork: work.id, private: false, editions, translations: englishes };
}

async function openPrivate(workId: string): Promise<Book> {
  const code = savedCode();
  if (!code) throw new SyncFirst("Sync this device to open your private texts.");
  const got = await getPrivate(code, mineId(workId));
  if (got.state === "missing") throw new NoSuchBook("There is no private text with this name.");
  if (got.state === "broken") throw new NoSuchBook(`This private text no longer passes the check: ${got.problems.join(" ")}`);
  const stored = got.doc;
  const lookupWork = workOf(stored.urn)?.work ?? workId;
  if (lookupWork !== workId) prefetch(lookupWork);
  const { work, author } = mineBook(stored);
  // your own English where the text has it, else the published English it carries
  const version = stored.passages.some((p) => p.rows.some((r) => r.english)) ? "ours" : hasPublished(stored) ? "published" : null;
  const { doc, placed } = mineParsed(stored, version);
  const tr = version ? work.texts.find((t) => t.urn.endsWith(`.${version}`)) ?? null : null;
  return { work, author, grc: work.texts[0], tr, doc, placed, lookupWork, private: true, editions: [], translations: [] };
}
