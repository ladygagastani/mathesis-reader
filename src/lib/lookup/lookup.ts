/**
 * Everything the look-up shows for one word, gathered in one go so that the first layer appears whole rather than filling in
 * under the eye: GLAUx's analysis of the word at its place (or, for a text GLAUx lacks, how GLAUx reads the form in its other texts,
 * or failing that the Morpheus parser's reading), where it stands in the treebank's sentence, how often its dictionary form occurs
 * in the work, its LSJ entry and its core-vocabulary entry, and the card made from them (card.ts).
 */
import { candidates, lookupForm } from "@/lib/greek";
import { loadSyntax } from "@/lib/syntax";
import type { TeiDoc } from "@/lib/tei/types";
import { lookupCard, treeAt, type Card, type InSentence } from "./card";
import { coreEntry, type CoreEntry } from "./core";
import { formReading } from "./forms";
import { lsjEntries, type LsjEntry } from "./lsj";
import { parserReading } from "./morpheus";
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
  /** the core vocabulary's entry for the dictionary form: its full heading, its class, its group and how common it is */
  core: CoreEntry | null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function lookUp(at: WordAt): Promise<Looked> {
  const keys = new Set(at.doc.units.map((u) => u.ref.join(".")));
  let analysisError: string | undefined;
  const [pack, syn] = await Promise.all([
    loadWordPack(at.work).catch((e) => { analysisError = message(e); return null; }),
    loadSyntax(at.work).catch(() => null),
  ]);
  // the work's own analysis; failing that (no pack for the work, or a form its pack lacks), how GLAUx reads the form in its other
  // texts; failing that, the Morpheus parser
  const analysis = (pack ? analyse(pack, at.word, at.unitKey, at.occurrence, keys, at.doc.levels.length) : null)
    ?? await formReading(at.word).catch(() => null)
    ?? await parserReading(at.word).catch(() => null);
  const tree = pack ? treeAt(pack, syn, at.doc, at.unitKey, at.i) : null;
  const occurs = pack && analysis ? countLemma(pack, analysis.lemma) : null;

  let lsj: Looked["lsj"] = null, lsjError: string | undefined;
  try {
    // a reading from outside the work (the form index, the parser) may name a dictionary form LSJ files otherwise: then the word's own spellings
    const guessed = analysis?.where === "corpus" || analysis?.where === "parser";
    for (const h of analysis ? [analysis.lemma, ...(guessed ? candidates(at.word) : [])] : candidates(at.word)) {
      lsj = await lsjEntries(h);
      if (lsj) break;
    }
  } catch (e) { lsjError = message(e); }
  const core = await coreEntry(analysis?.lemma ?? lookupForm(at.word)).catch(() => null);

  const card = lookupCard({ analysis, tree, core, lsj });
  return { card, analysis, analysisError, tree, occurs, lsj, lsjError, core };
}

/**
 * A word met outside the text (one of a word's family, followed from the look-up): its LSJ entry and its core-vocabulary entry
 * only. With no place in a passage it has no analysis, no sentence and no count.
 */
export async function lookUpHeadword(word: string): Promise<Looked> {
  let lsj: Looked["lsj"] = null, lsjError: string | undefined;
  try {
    for (const h of candidates(word)) {
      lsj = await lsjEntries(h);
      if (lsj) break;
    }
  } catch (e) { lsjError = message(e); }
  const core = await coreEntry(lsj?.head ?? lookupForm(word)).catch(() => null);
  const card = lookupCard({ analysis: null, tree: null, core, lsj });
  return { card, analysis: null, tree: null, occurs: null, lsj, lsjError, core };
}
