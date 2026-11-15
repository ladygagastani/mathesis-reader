/**
 * The credits at the foot of the look-up's second layer (the quiet desk, ticket 06): one quiet line, naming only the sources
 * that were actually shown for this word. No other credit appears anywhere in the look-up.
 */
import { CORE_CREDIT } from "./core";

export interface Credit { text: string; href?: string }

/** GLAUx, for the analysis and the treebank that the card and the grammar come from */
export const GLAUX_CREDIT = "Analysis and treebank: GLAUx (Keersmaekers 2021), CC BY-SA 4.0";
/** the Morpheus parser, for a form no text in GLAUx has (morpheus.ts) */
export const MORPHEUS_CREDIT = "Parsing: Morpheus, Perseus Digital Library at Tufts University, through the Alpheios morphology service";
/** LSJ_CREDIT (lsj.ts) is Perseus's full wording, with its funding and address; the line at the foot keeps the source and the licence */
export const LSJ_CREDIT_SHORT = "LSJ: Perseus Digital Library, CC BY-SA";
/** the Middle Liddell, for a meaning from the meaning list (meanings.ts): Perseus's wording, with its funder */
export const ML_CREDIT = "Middle Liddell: text provided by Perseus Digital Library, with funding from The Annenberg CPB/Project, CC BY-SA 3.0 US";
/** Wiktionary, for a meaning from it (the meaning list reads kaikki.org's extract of it; a name not in the list is asked live) */
export const WIKT_CREDIT = "Meaning: English Wiktionary, CC BY-SA 4.0";

export interface Shown {
  /** GLAUx's analysis of the word, or its place in the treebank, is on the look-up */
  glaux: boolean;
  /** the grammar came from the Morpheus parser (morpheus.ts) */
  parser?: boolean;
  /** an LSJ entry is on the look-up */
  lsj: boolean;
  /** the card's meaning came from the core vocabulary */
  core: boolean;
  /** the card's meaning came from the Middle Liddell */
  ml?: boolean;
  /** the card's meaning came from Wiktionary */
  wikt?: boolean;
}

export function creditsFor(shown: Shown): Credit[] {
  const out: Credit[] = [];
  if (shown.glaux) out.push({ text: GLAUX_CREDIT });
  if (shown.parser) out.push({ text: MORPHEUS_CREDIT });
  if (shown.lsj) out.push({ text: LSJ_CREDIT_SHORT });
  if (shown.core) out.push({ text: CORE_CREDIT });
  if (shown.ml) out.push({ text: ML_CREDIT });
  if (shown.wikt) out.push({ text: WIKT_CREDIT });
  return out;
}
