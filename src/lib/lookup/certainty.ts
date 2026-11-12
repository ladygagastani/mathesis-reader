/**
 * How sure the look-up is of the grammar it shows: one quiet sentence at the foot of the second layer, not a badge (the quiet
 * desk, ticket 06). It says only what GLAUx's analysis says of itself: checked by hand in the treebank, or made by a program
 * (about 97% right), or matched to the passage rather than the exact word, or found elsewhere in the work; or, for a text GLAUx
 * lacks, how GLAUx reads the form in its other texts, or the Morpheus parser's readings.
 */
import { MORPHEUS_HOST } from "./morpheus";
import { readTag } from "./postag";
import type { Analysis } from "./words";

/** `a` is GLAUx's analysis of the word; null says it has none (`error`: why it could not be loaded). */
export function certaintyNote(a: Analysis | null, error?: string): string {
  if (!a) return error ? `Word analyses could not be loaded (${error}).` : "No analysis is available for this text yet.";
  if (a.where === "here") return a.manual ? "Checked by hand: this analysis comes from the treebank." : "Automatic analysis, about 97% accurate.";
  if (a.where === "passage") return "Matched to this passage, not to this exact word.";
  if (a.where === "corpus") {
    const readings = a.others.map((o) => {
      const p = readTag(o.tag);
      return `${o.lemma}, ${p.pos}${p.detail ? ` · ${p.detail}` : ""} (${o.n.toLocaleString("en")}×)`;
    });
    return `This word is not analysed in this text. In GLAUx's other texts the form is read as ${readings.join("; ")}.`;
  }
  if (a.where === "parser") {
    const readings = a.others.slice(0, 4).map((o) => {
      const p = readTag(o.tag);
      return `${o.lemma}, ${p.pos}${p.detail ? ` · ${p.detail}` : ""}`;
    });
    return `No text in GLAUx has this form. The word was sent to the Morpheus parser (${MORPHEUS_HOST}), which does not see the sentence; `
      + (readings.length > 1 ? `its readings: ${readings.join("; ")}${a.others.length > 4 ? "; and more" : ""}.` : `its reading: ${readings[0]}.`);
  }
  const elsewhere = a.others.slice(0, 4).map((o) => {
    const p = readTag(o.tag);
    return `${o.lemma}, ${p.pos}${p.detail ? ` · ${p.detail}` : ""} (${o.n}×)`;
  });
  return `This exact place could not be matched; elsewhere in this work the form is analysed as ${elsewhere.join("; ")}.`;
}
