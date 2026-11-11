/** A parsed TEI text, reduced to what the reader shows. Text content is never altered. */

export type Inline =
  | string
  | { m: string; n?: string }        // milestone: unit and number (line, section, page, card, para…)
  | { note: string }                  // editorial note, shown as a marker
  | { gap: true };                    // a gap in the transmitted text

export type Block =
  | { t: "p"; c: Inline[]; speaker?: string }
  | { t: "l"; n?: string; c: Inline[]; speaker?: string; para?: boolean; part?: string }   // part: the division's subtype (strophe, episode…)
  | { t: "head"; c: Inline[] };

/** One citable passage: a line of verse, a section of prose… */
export interface Unit {
  ref: string[];        // one value per citation level, e.g. ["1", "33"]
  blocks: Block[];
}

export interface TeiDoc {
  lang: string | null;
  levels: string[];     // citation level names, e.g. ["book", "line"]
  units: Unit[];
  /** How the reader should split the text into pages ("chunks"). */
  chunks: { label: string; first: number; last: number }[];   // indexes into units, inclusive
}
