/**
 * The credits at the foot of the look-up's second layer (the quiet desk, ticket 06): one quiet line, naming only the sources
 * that were actually shown for this word. No other credit appears anywhere in the look-up.
 */
import { CORE_CREDIT } from "./core";

export interface Credit { text: string; href?: string }

/** GLAUx, for the analysis and the treebank that the card and the grammar come from */
export const GLAUX_CREDIT = "Analysis and treebank: GLAUx (Keersmaekers 2021), CC BY-SA 4.0";
/** LSJ_CREDIT (lsj.ts) is Perseus's full wording, with its funding and address; the line at the foot keeps the source and the licence */
export const LSJ_CREDIT_SHORT = "LSJ: Perseus Digital Library, CC BY-SA";

export interface Shown {
  /** GLAUx's analysis of the word, or its place in the treebank, is on the look-up */
  glaux: boolean;
  /** an LSJ entry is on the look-up */
  lsj: boolean;
  /** the card's meaning came from the core vocabulary */
  core: boolean;
}

export function creditsFor(shown: Shown): Credit[] {
  const out: Credit[] = [];
  if (shown.glaux) out.push({ text: GLAUX_CREDIT });
  if (shown.lsj) out.push({ text: LSJ_CREDIT_SHORT });
  if (shown.core) out.push({ text: CORE_CREDIT });
  return out;
}
