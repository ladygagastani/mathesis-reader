/**
 * How sure the look-up is of the grammar it shows: one quiet sentence at the foot of the second layer, not a badge (the quiet
 * desk, ticket 06). It says only what GLAUx's analysis says of itself: checked by hand in the treebank, or made by a program
 * (about 97% right), or matched to the passage rather than the exact word, or found elsewhere in the work.
 */
import { readTag } from "./postag";
import type { Analysis } from "./words";

/** `a` is GLAUx's analysis of the word; null says it has none (`error`: why it could not be loaded). */
export function certaintyNote(a: Analysis | null, error?: string): string {
  if (!a) return error ? `Word analyses could not be loaded (${error}).` : "No analysis is available for this text yet.";
  if (a.where === "here") return a.manual ? "Checked by hand: this analysis comes from the treebank." : "Automatic analysis, about 97% accurate.";
  if (a.where === "passage") return "Matched to this passage, not to this exact word.";
  const elsewhere = a.others.slice(0, 4).map((o) => {
    const p = readTag(o.tag);
    return `${o.lemma}, ${p.pos}${p.detail ? ` · ${p.detail}` : ""} (${o.n}×)`;
  });
  return `This exact place could not be matched; elsewhere in this work the form is analysed as ${elsewhere.join("; ")}.`;
}
