/**
 * TEI blocks drawn exactly as the file gives them (lib/tei/pieces.ts decides what shows). In Greek every word is a span the reader
 * can click; the first word of each passage is in the keyboard's Tab order, and the arrow keys go from word to word (Reader.tsx).
 */
import { Fragment, memo } from "react";
import { lineNo, pieces, repeatsMargin } from "@/lib/tei/pieces";
import type { Block, Inline } from "@/lib/tei/types";
import styles from "./Reader.module.css";

function Run({ c, greek, margin, first }: { c: Inline[]; greek: boolean; margin?: string; first?: { done: boolean } }) {
  return pieces(c, greek, margin).map((p, i) => {
    switch (p.k) {
      case "t": return <Fragment key={i}>{p.text}</Fragment>;
      case "g": return <span key={i} lang="grc">{p.text}</span>;
      case "w": {
        const tab = first && !first.done ? 0 : -1;
        if (first) first.done = true;
        return <span key={i} className={styles.w} role="button" tabIndex={tab}>{p.text}</span>;
      }
      case "mark": return <span key={i} className={styles.mk} aria-label={`${p.kind} ${p.n}`}>{p.n}</span>;
      case "note": return <sup key={i} className={styles.note} title={p.text} aria-label={`Note: ${p.text}`} tabIndex={0}>*</sup>;
      case "gap": return <span key={i} className={styles.gap} title="A gap in the text">…</span>;
    }
  });
}

/** `margin`: the passage's number, when these blocks begin their passage (what only repeats it is left out at the start). */
export const Blocks = memo(function Blocks({ blocks, greek, margin }: { blocks: Block[]; greek: boolean; margin?: string }) {
  const lead = margin === undefined ? -1 : blocks.findIndex((b) => b.t !== "head");
  const first = greek ? { done: false } : undefined;
  return blocks.map((b, i) => {
    const at = i === lead ? margin : undefined;
    const speaker = "speaker" in b && b.speaker ? <span className={styles.speaker}>{b.speaker}</span> : null;
    // (a heading's Greek words are clickable too: the look-up counts a passage's words with them, tei/words.ts)
    if (b.t === "head") return <p key={i} className={styles.head}><Run c={b.c} greek={greek} first={first} /></p>;
    if (b.t === "l") {
      return (
        <div key={i} className={`${styles.line} ${b.para ? styles.para : ""}`}>
          {speaker}
          <span className={styles.ln} aria-hidden="true">{at !== undefined && b.n && repeatsMargin(b.n, at) ? "" : lineNo(b.n)}</span>
          <span className={styles.lt}><Run c={b.c} greek={greek} margin={at} first={first} /></span>
        </div>
      );
    }
    return <p key={i} className={styles.p}>{speaker}<Run c={b.c} greek={greek} margin={at} first={first} /></p>;
  });
});
