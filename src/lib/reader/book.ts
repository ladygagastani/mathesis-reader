/**
 * Opening a book: the work in the catalogue, its first Greek edition and its first English translation, both read from GitHub at the
 * catalogue's pinned version and parsed off the main thread, with the English placed beside the Greek passage by passage. The word
 * analyses for the work start loading with the texts, so the first look-up seldom waits for them. (Starting them after the texts
 * was measured on a slow phone, scripts/weigh.mjs: the Greek showed no sooner, and the first look-up was slower.)
 *
 * A private text (w=mine:<id>) comes from the database instead, for its signed-in owner only, and becomes a book the same way the
 * old app made one (lib/mine/mine.ts). Its words are looked up in the analyses of the work it names (its urn), if it names one.
 */
import { greekEditions, loadCatalog, translations, type CatAuthor, type CatText, type CatWork } from "@/lib/catalog";
import { getXml } from "@/lib/texts/source";
import { parseInWorker } from "@/lib/tei/client";
import { schemeFor } from "@/lib/tei/versification";
import type { Placed } from "@/lib/tei/align";
import type { TeiDoc } from "@/lib/tei/types";
import { loadWordPack } from "@/lib/lookup/words";
import { loadSyntax } from "@/lib/syntax";
import { getPrivate, hasSavedSession } from "@/lib/account";
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
  /** a private text: only its owner can see it */
  private: boolean;
}

export class NoSuchBook extends Error {}
/** A private text, asked for by someone not signed in on this browser. */
export class SignInFirst extends Error {}

function prefetch(work: string) {
  loadWordPack(work).catch(() => null);
  loadSyntax(work).catch(() => null);
}

export async function openBook(workId: string): Promise<Book> {
  if (isMine(workId)) return openPrivate(workId);
  const idx = await loadCatalog();
  const work = idx.work.get(workId);
  const author = idx.authorOf.get(workId);
  const grc = work ? greekEditions(work)[0] : undefined;
  if (!work || !author || !grc) throw new NoSuchBook(`The library has no Greek text for "${workId}".`);
  prefetch(work.id);
  const tr = translations(work)[0] ?? null;
  const [grcXml, trXml] = await Promise.all([getXml(idx, grc), tr ? getXml(idx, tr).catch(() => null) : null]);
  const { doc, placed } = await parseInWorker(grcXml, trXml, tr ? schemeFor(work.id, tr) : undefined, tr?.urn);
  return { work, author, grc, tr: trXml ? tr : null, doc, placed, lookupWork: work.id, private: false };
}

async function openPrivate(workId: string): Promise<Book> {
  if (!hasSavedSession()) throw new SignInFirst("Sign in to open your private texts.");
  const got = await getPrivate(mineId(workId));
  if (got.state === "missing") throw new NoSuchBook("There is no private text with this name in your account.");
  if (got.state === "broken") throw new NoSuchBook(`This private text no longer passes the check: ${got.problems.join(" ")}`);
  const stored = got.doc;
  const lookupWork = workOf(stored.urn)?.work ?? workId;
  if (lookupWork !== workId) prefetch(lookupWork);
  const { work, author } = mineBook(stored);
  // your own English where the text has it, else the published English it carries
  const version = stored.passages.some((p) => p.rows.some((r) => r.english)) ? "ours" : hasPublished(stored) ? "published" : null;
  const { doc, placed } = mineParsed(stored, version);
  const tr = version ? work.texts.find((t) => t.urn.endsWith(`.${version}`)) ?? null : null;
  return { work, author, grc: work.texts[0], tr, doc, placed, lookupWork, private: true };
}
