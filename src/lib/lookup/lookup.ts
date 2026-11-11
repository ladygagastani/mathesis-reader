/**
 * Everything the look-up shows for one word, gathered in one go so that the first layer appears whole rather than filling in
 * under the eye: GLAUx's analysis of the word at its place, where it stands in the treebank's sentence, how often its dictionary
 * form occurs in the work, its LSJ entry and its core-vocabulary entry, and the card made from them (card.ts).
 */
import { candidates, lookupForm } from "@/lib/greek";
import { loadSyntax } from "@/lib/syntax";
import type { TeiDoc } from "@/lib/tei/types";
import { lookupCard, treeAt, type Card, type InSentence } from "./card";
import { coreEntry } from "./core";
import { lsjEntries, type LsjEntry } from "./lsj";
import { countLemma } from "./occurrences";
import { analyse, loadWordPack, type Analysis } from "./words";

/** A word as it stands on the page. */
export interface WordAt {
  work: string;
  word: string;
  /** its passage's reference ("17") */
  unitKey: string;
  /** its number among the passage's words (tei/words.ts, unitWords) */
  i: number;
  /** how many words of the same spelling come before it in the passage */
  occurrence: number;
  doc: TeiDoc;
}

export interface Looked {
  card: Card;
  analysis: Analysis | null;
  /** why the word analyses could not be loaded, when they could not */
  analysisError?: string;
  tree: InSentence | null;
  /** how many words of the work have this dictionary form; null when it cannot be counted */
  occurs: number | null;
  lsj: { head: string; entries: LsjEntry[] } | null;
  lsjError?: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function lookUp(at: WordAt): Promise<Looked> {
  const keys = new Set(at.doc.units.map((u) => u.ref.join(".")));
  let analysisError: string | undefined;
  const [pack, syn] = await Promise.all([
    loadWordPack(at.work).catch((e) => { analysisError = message(e); return null; }),
    loadSyntax(at.work).catch(() => null),
  ]);
  const analysis = pack ? analyse(pack, at.word, at.unitKey, at.occurrence, keys, at.doc.levels.length) : null;
  const tree = pack ? treeAt(pack, syn, at.doc, at.unitKey, at.i) : null;
  const occurs = pack && analysis ? countLemma(pack, analysis.lemma) : null;

  let lsj: Looked["lsj"] = null, lsjError: string | undefined;
  try {
    for (const h of analysis ? [analysis.lemma] : candidates(at.word)) {
      lsj = await lsjEntries(h);
      if (lsj) break;
    }
  } catch (e) { lsjError = message(e); }
  const core = await coreEntry(analysis?.lemma ?? lookupForm(at.word)).catch(() => null);

  const card = lookupCard({ analysis, tree, core, lsj });
  return { card, analysis, analysisError, tree, occurs, lsj, lsjError };
}
