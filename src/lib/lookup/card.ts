/**
 * The look-up card: what the first layer of the look-up shows for a word (the quiet desk, ticket 05;
 * docs/adr/0009-the-quiet-desk.md, decision 4). A pure function of what is already loaded for the word: GLAUx's analysis,
 * the treebank sentence it stands in, the core vocabulary and LSJ. It shows the dictionary form, the kind of word, ONE
 * meaning with its source named, what the word does in this sentence (only where the treebank says), and its grammar in
 * plain words. Nothing here is composed: a meaning is a core-list definition or LSJ's short definition, word for word,
 * or a plain statement that there is none.
 */
import { governor, packForms, readSentence, sentenceOf, type Sentence, type Syntax } from "@/lib/syntax";
import { unitWords } from "@/lib/tei/words";
import { placeAnalyses, positionsFor } from "./placed";
import { kindOf, plainGrammar } from "./postag";
import type { WordPack } from "./words";
import type { TeiDoc } from "@/lib/tei/types";

/** A word's place in its treebank sentence: the sentence, and the node that is this word. */
export interface InSentence { sentence: Sentence; at: number }

export interface CardInput {
  /** GLAUx's analysis of the word in this passage, if there is one */
  analysis: { lemma: string; tag: string } | null;
  /** the word in its treebank sentence, only where the treebank has this very word */
  tree: InSentence | null;
  /** the core vocabulary's entry for the dictionary form, if it is one of the commonest words */
  core: { def: string } | null;
  /** LSJ's entries for the dictionary form (or for the word, with no analysis) */
  lsj: { head: string; entries: { s: string }[] } | null;
}

export interface Card {
  /** the dictionary form */
  lemma: string | null;
  /** "noun, feminine" */
  kind: string | null;
  meaning: {
    text: string;
    /** where the text comes from: the core list, LSJ, or nowhere (the text is then a plain statement, not a meaning) */
    source: "core" | "lsj" | null;
  };
  /** what the word does in its sentence: "object of ἄειδε", only where the treebank says */
  role: Role | null;
  /** "Accusative singular" */
  grammar: string | null;
}

/** "Here it is the object of ἄειδε.": the words before the governor, and the governor (none for the main verb). */
export interface Role {
  text: string;
  /** "Here it is the object of" */
  lead: string;
  governor: string | null;
}

export const SOURCE_NAMES = { core: "the core vocabulary list", lsj: "LSJ" } as const;
/** said plainly when neither dictionary has the word */
export const NO_ENTRY = "Not in the dictionaries this site uses.";
/** said plainly when LSJ has an entry but gives no short definition */
export const NO_SHORT = "LSJ has no short definition for it. See More about it.";

/**
 * The treebank's relations in plain words (after ROLES in lib/syntax.ts), written to follow "Here it is …" and the word
 * the relation hangs on: the article, then the phrase. A relation not listed here (a vocative, a particle, a comma…)
 * shows no role, rather than a guess.
 */
const RELATIONS: Record<string, [article: string, phrase: string]> = {
  SBJ: ["the", "subject of"],
  OBJ: ["the", "object of"],
  PNOM: ["the", "predicate of"],
  OCOMP: ["the", "object complement of"],
  ATR: ["an", "attribute of"],
  ADV: ["an", "adverbial addition to"],
  APOS: ["", "in apposition to"],
};

/** What the word at `tree.at` does in its sentence, through the word it really belongs to (past joining words and prepositions). */
function roleIn(tree: InSentence): Role | null {
  const { sentence: s, at } = tree;
  if (!s.nodes[at]) return null;
  const { g, rel } = governor(s, at);
  // the main verb hangs on nothing
  if (g < 0) return rel === "PRED" ? { text: "main verb of the sentence", lead: "Here it is the main verb of the sentence", governor: null } : null;
  const on = s.nodes[g]?.form;
  const words = RELATIONS[rel];
  if (!on || !words) return null;   // a supplied word has no name to give; an unlisted relation is not guessed
  const [article, phrase] = words;
  return { text: `${phrase} ${on}`, lead: ["Here it is", article, phrase].filter(Boolean).join(" "), governor: on };
}

/** One meaning: the core list's definition, otherwise LSJ's short definition; or a plain statement that there is none. */
function meaningOf(core: CardInput["core"], lsj: CardInput["lsj"]): Card["meaning"] {
  if (core?.def) return { text: core.def, source: "core" };
  if (lsj?.entries.length) return lsj.entries[0].s ? { text: lsj.entries[0].s, source: "lsj" } : { text: NO_SHORT, source: null };
  return { text: NO_ENTRY, source: null };
}

export function lookupCard({ analysis, tree, core, lsj }: CardInput): Card {
  return {
    lemma: analysis?.lemma ?? lsj?.head ?? null,
    kind: analysis ? kindOf(analysis.tag) : null,
    meaning: meaningOf(core, lsj),
    role: tree ? roleIn(tree) : null,
    grammar: analysis ? plainGrammar(analysis.tag) || null : null,
  };
}

/**
 * The word at `ref`, number `i` among that passage's words on screen, in its treebank sentence; null where there is no
 * treebank for the work (`syn` is null), or the treebank has no such word (a private text, or a word the two editions
 * spell differently).
 */
export function treeAt(pack: WordPack, syn: Syntax | null, doc: TeiDoc, ref: string, i: number): InSentence | null {
  if (!syn) return null;
  const placed = placeAnalyses(pack, doc);
  const unit = placed.unitOf.get(ref);
  if (unit === undefined) return null;
  // (the passage's clickable words are numbered as unitWords gives them, as in SentencePanel)
  const pos = positionsFor(placed, ref, unitWords(doc.units[unit]))[i] ?? -1;
  const p = pos >= 0 ? placed.word[pos] : -1;
  const n = p >= 0 ? sentenceOf(syn, p) : -1;
  if (n < 0) return null;
  const sentence = readSentence(syn, n, packForms(pack));
  const at = sentence.nodes.findIndex((x) => x.p === p);
  return at >= 0 ? { sentence, at } : null;
}
