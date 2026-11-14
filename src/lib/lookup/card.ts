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
import type { WiktSense } from "./wiktionary";
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
  /** Wiktionary's senses for a proper name's dictionary form, asked only when neither dictionary gives the name a meaning */
  wikt?: WiktSense[] | null;
}

export interface Card {
  /** the dictionary form */
  lemma: string | null;
  /** "noun, feminine" */
  kind: string | null;
  meaning: {
    text: string;
    /** where the text comes from: the core list, LSJ, Wiktionary (for a name), or nowhere (the text is then a plain statement,
     *  not a meaning) */
    source: "core" | "lsj" | "wikt" | null;
  };
  /** what the word does in its sentence: "object of ἄειδε", only where the treebank says */
  role: Role | null;
  /** "Accusative singular" */
  grammar: string | null;
}

/** "Here, it is the object of ἄειδε.": the words before the governor, and the governor (none for the main verb). */
export interface Role {
  text: string;
  /** "Here, it is the object of" */
  lead: string;
  governor: string | null;
}

export const SOURCE_NAMES = { core: "the core vocabulary list", lsj: "LSJ", wikt: "Wiktionary" } as const;
/** said plainly when neither dictionary has the word */
export const NO_ENTRY = "Not in the dictionaries this site uses.";
/** True when the card says the dictionaries lack the word but a dictionary could not be loaded: then nobody knows, and the
 *  look-up must say the load failed, never that the word is missing (PRODUCT.md, principle 3). */
export const couldNotLoad = (meaning: string, errors: (string | undefined)[]) => (meaning === NO_ENTRY || meaning === NAME_NO_ENTRY) && errors.some(Boolean);
/** said plainly when LSJ has an entry but gives no short definition */
export const NO_SHORT = "LSJ has no short definition for it. See More about it.";
/** the same two statements for a proper name Wiktionary does not describe either: at least it is said to be a name */
export const NAME_NO_ENTRY = "A proper name, not in the dictionaries this site uses.";
export const NAME_NO_SHORT = "A proper name. LSJ has no short definition for it: see More about it.";

/** A proper name: the dictionaries spell names with a capital, and only names (a sentence's first word is looked up without it). */
export const isName = (lemma: string | null | undefined) => !!lemma && /^\p{Lu}/u.test(lemma.normalize("NFC"));

/**
 * The treebank's relations in plain words (after ROLES in lib/syntax.ts), written to follow "Here, it is …" and the word
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
  if (g < 0) return rel === "PRED" ? { text: "main verb of the sentence", lead: "Here, it is the main verb of the sentence", governor: null } : null;
  const on = s.nodes[g]?.form;
  const words = RELATIONS[rel];
  if (!on || !words) return null;   // a supplied word has no name to give; an unlisted relation is not guessed
  const [article, phrase] = words;
  return { text: `${phrase} ${on}`, lead: ["Here, it is", article, phrase].filter(Boolean).join(" "), governor: on };
}

/**
 * LSJ's short definition (or the core list's) tidied, with nothing added. Two things are taken out:
 * - A dangling end. The short definitions were cut out of the entries by a program, and some stop on a word that only led into the
 *   next phrase: ἐξαπατάω's is "deceive, beguile, deceive thoroughly, seduce, in", where the entry goes on "in a thing". A last
 *   phrase of one such word (a preposition, an article, "or", "and") is dropped.
 * - A gloss given again. The program took a gloss from each sense, so φαντασία's reads "appearing, appearance, appearing,
 *   appearance, presentation, appearance". Each gloss is kept once, where it first stands. Between two kept glosses stands the
 *   strongest mark that stood between them (a semicolon over a comma), so the senses stay parted as LSJ parted them.
 */
export function trimShort(s: string): string {
  const cut = s.replace(/[,;:]\s*(?:in|of|to|with|by|for|from|on|at|into|upon|as|a|an|the|or|and)\s*$/i, "").trim();
  // the glosses and the marks between them, parted only outside brackets: "whole (with article, or not)" is one gloss
  const glosses: string[] = [], marks: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < cut.length; i++) {
    const c = cut[i];
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (depth === 0 && (c === "," || c === ";")) { glosses.push(cut.slice(from, i)); marks.push(c); from = i + 1; }
  }
  glosses.push(cut.slice(from));
  const seen = new Set<string>();
  let out = "", mark = "";
  glosses.forEach((g, i) => {
    const text = g.trim(), key = text.toLowerCase().replace(/\s+/g, " ");
    if (text && !seen.has(key)) {
      seen.add(key);
      out += out ? `${mark} ${text}` : text;
      mark = "";
    }
    const m = marks[i];
    if (m && (m === ";" || !mark)) mark = m;
  });
  return out;
}

/**
 * What a proper name is, from Wiktionary's first line for it, as "Glaucon, a man’s name": the English name, then what it names
 * where Wiktionary's words say so (a man or a woman, a god, a city, a river, a mountain, an island, a region, a people, a
 * festival), otherwise "a proper name". For a name that is not a noun, Wiktionary's line stands as it is ("to Athens" for
 * Ἀθήναζε). Null when Wiktionary has nothing for it.
 */
export function nameMeaning(senses: WiktSense[] | null | undefined): string | null {
  const proper = senses?.find((x) => /proper noun/i.test(x.pos) && x.lines.length);
  if (!proper) {
    const any = senses?.find((x) => x.lines.length);
    return any ? tidyLine(any.lines[0]) : null;
  }
  const line = tidyLine(proper.lines[0]);
  const what = nameKind(line);
  const given = /given name,?\s*(?:equivalent to English\s+)?([^,;(.]+)/i.exec(line)?.[1]?.trim();
  const english = (given ?? line.split(/[,;(/]/)[0])
    .replace(/^(?:the\s+)?(?:river|mount|mountain|island|city|town|sea|gulf)\s+/i, "").replace(/^the\s+/i, "").trim();
  if (!english || /given name/i.test(english)) return `${capital(what)}.`;
  return `${english}, ${what}`;
}
const capital = (s: string) => s.charAt(0).toLocaleUpperCase("en") + s.slice(1);
/** a Wiktionary line made a meaning: one space between words, and no reference marks */
const tidyLine = (s: string) => s.replace(/\s+/g, " ").replace(/\s*\[\d+\]/g, "").trim();
/** what a name names, from the words of Wiktionary's line, the first that matches */
const KINDS: [RegExp, string][] = [
  [/\bfemale (?:given )?name\b|\bwoman's name\b/i, "a woman’s name"],
  [/\bmale (?:given )?name\b|\bman's name\b/i, "a man’s name"],
  [/\bgoddess\b|\bnymph\b|\bmuse\b/i, "a goddess"],
  [/\bgod\b|\bdeity\b|\btitan\b/i, "a god"],
  [/\bfestival\b/i, "a festival"],
  [/\bcity\b|\btown\b|\bpolis\b/i, "a city"],
  [/\briver\b/i, "a river"],
  [/\bmountain\b|\bmount\b/i, "a mountain"],
  [/\bisland\b/i, "an island"],
  [/\bsea\b|\bgulf\b|\blake\b/i, "a sea"],
  [/\bregion\b|\bcountry\b|\bdistrict\b|\bkingdom\b|\bprovince\b|\bpeninsula\b/i, "a region"],
  [/\bpeople\b|\btribe\b|\binhabitants?\b/i, "a people"],
  [/,\s*(?:Turkey|Greece|Italy|Sicily|Egypt|Cyprus|Albania|Bulgaria|Libya|Syria|Lebanon|Israel|France|Spain|Ukraine)\b/, "a place"],
  [/\b(?:king|queen|hero|heroine|philosopher|poet|historian|orator|general|tyrant|patriarch|son of|daughter of|wife of)\b/i, "a person"],
];
const nameKind = (line: string) => KINDS.find(([re]) => re.test(line))?.[1] ?? "a proper name";

/**
 * One meaning: the core list's definition, otherwise LSJ's short definition; for a proper name neither gives, what Wiktionary
 * says it names; or a plain statement that there is none (that it is a name, at least, where it is one).
 */
function meaningOf(core: CardInput["core"], lsj: CardInput["lsj"], wikt: CardInput["wikt"], name: boolean): Card["meaning"] {
  if (core?.def) return { text: trimShort(core.def), source: "core" };
  if (lsj?.entries[0]?.s) return { text: trimShort(lsj.entries[0].s), source: "lsj" };
  const named = name ? nameMeaning(wikt) : null;
  if (named) return { text: named, source: "wikt" };
  if (lsj?.entries.length) return { text: name ? NAME_NO_SHORT : NO_SHORT, source: null };
  return { text: name ? NAME_NO_ENTRY : NO_ENTRY, source: null };
}

/** The kind of word, a proper name's as a proper noun: "proper noun, masculine". */
function kindFor(tag: string, name: boolean): string {
  const kind = kindOf(tag);
  return name && kind.startsWith("noun") ? `proper ${kind}` : kind;
}

export function lookupCard({ analysis, tree, core, lsj, wikt }: CardInput): Card {
  const lemma = analysis?.lemma ?? lsj?.head ?? null;
  const name = isName(lemma);
  return {
    lemma,
    kind: analysis ? kindFor(analysis.tag, name) : null,
    meaning: meaningOf(core, lsj, wikt, name),
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
