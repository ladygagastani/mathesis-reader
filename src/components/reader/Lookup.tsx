"use client";
/**
 * The word look-up (ADR 0009, decisions 1 and 4). One placement per device: at 1100 px and wider a window over the right margin, fixed
 * while the text scrolls; below, a low sheet from the foot of the screen, and the reader keeps the word above it (Reader.tsx).
 * Layer one: the dictionary form, the kind of word and the word tapped, one meaning with its source, what the word does in the
 * sentence (only where the treebank says), the grammar in plain words, and a plain warning when the analysis is not of this very
 * word. "More about it" opens layer two in the same place: LSJ, how often the word occurs in the book, how sure the analysis is,
 * and the credits for what was shown. Nothing here is composed: every line comes from a source or says plainly there is none.
 */
import Link from "next/link";
import Icon from "@/components/Icon";
import { useEffect, useRef, useState } from "react";
import { candidates, lookupForm } from "@/lib/greek";
import { SOURCE_NAMES } from "@/lib/lookup/card";
import { certaintyNote } from "@/lib/lookup/certainty";
import { creditsFor } from "@/lib/lookup/credits";
import { lookUp, type Looked, type WordAt } from "@/lib/lookup/lookup";
import { citationHref, type LsjEntry, type Seg } from "@/lib/lookup/lsj";
import { readTag } from "@/lib/lookup/postag";
import { lookUpWiktionary, type WiktResult } from "@/lib/lookup/wiktionary";
import { occursLine } from "@/lib/lookup/occurrences";
import type { LookupPlace } from "@/lib/lookup/placement";
import { otherDefinitions } from "@/lib/lookup/repeats";
import styles from "./Lookup.module.css";

function Segs({ segs }: { segs: Seg[] }) {
  return segs.map((s, i) => {
    if (typeof s === "string") return <span key={i}>{s}</span>;
    if ("g" in s) return <span key={i} lang="grc">{s.g}</span>;
    const href = citationHref(s.u);
    // LSJ runs a Greek word straight into the citation after it ("μήνιοςPl. R. 390e"): a space between them
    const prev = segs[i - 1];
    const gap = prev && typeof prev !== "string" && "g" in prev ? " " : "";
    return href ? <span key={i}>{gap}<Link href={href} className={styles.cite}>{s.c}</Link></span> : <span key={i}>{gap}{s.c}</span>;
  });
}

function Entry({ e }: { e: LsjEntry }) {
  return e.b.map(([level, label, segs], i) => (
    <p key={i} style={{ paddingLeft: `${Math.max(0, level - 1) * 0.9}em` }}>
      {label && <b className={styles.senseN}>{label}.</b>} <Segs segs={segs} />
    </p>
  ));
}

/** A plain line when the analysis shown is not of this very word (lookup/words.ts, Analysis.where). */
function unsure(l: Looked): string | null {
  if (!l.analysis || l.analysis.where === "here") return null;
  return l.analysis.where === "passage" ? "Uncertain: matched to this passage, not to this exact word." : "Uncertain: this is how the form is read elsewhere in the book.";
}

export default function Lookup({ at, place, note, layer, onLayer, onStep, onClose, workTitle, takeFocus, onNote }: {
  at: WordAt; place: LookupPlace;
  /** the window's left edge and width, over the margin (place "note") */
  note: { left: number; width: number } | null;
  layer: 1 | 2; onLayer: (l: 1 | 2) => void;
  onStep: (dir: 1 | -1) => void; onClose: () => void;
  workTitle: string;
  /** opened from the keyboard: the look-up takes the focus, so it is announced and its buttons are next */
  takeFocus: boolean;
  /** write a note on this word, its line or its passage */
  onNote: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const key = `${at.work}|${at.unitKey}|${at.i}`;
  const [got, setGot] = useState<{ key: string; value: Looked | null; error?: string }>({ key: "", value: null });
  const [whole, setWhole] = useState("");
  useEffect(() => {
    let live = true;
    lookUp(at).then((value) => { if (live) setGot({ key, value }); }, (e: Error) => { if (live) setGot({ key, value: null, error: e.message }); });
    return () => { live = false; };
  }, [key, at]);
  useEffect(() => { if (takeFocus) ref.current?.focus({ preventScroll: true }); }, [takeFocus, key, layer]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [layer, key]);
  // the start of LSJ's entry is clipped to a few lines: is there more under the clip? (only then the fade, and "The whole entry")
  const [preview, setPreview] = useState<HTMLDivElement | null>(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    if (!preview) return;
    const measure = () => setClipped(preview.hasAttribute("data-clip") && preview.scrollHeight > preview.clientHeight + 1);
    const watch = new ResizeObserver(measure);
    watch.observe(preview);
    return () => watch.disconnect();
  }, [preview]);

  const l = got.key === key ? got.value : null;
  // Wiktionary, live, beside LSJ
  const [wikt, setWikt] = useState<{ key: string; value: WiktResult | null; error?: string }>({ key: "", value: null });
  const needWikt = layer === 2 && !!l;
  useEffect(() => {
    if (!needWikt) return;
    const ctl = new AbortController();
    lookUpWiktionary(l!.card.lemma ? [l!.card.lemma, ...candidates(at.word)] : candidates(at.word), ctl.signal)
      .then((value) => setWikt({ key, value }))
      .catch((e: Error) => { if (!ctl.signal.aborted) setWikt({ key, value: null, error: e.message }); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needWikt, key]);
  const w = wikt.key === key ? wikt : null;
  const failed = got.key === key && !l;
  const card = l?.card ?? null;
  const head = layer === 2 && l ? card?.lemma ?? l.lsj?.head ?? lookupForm(at.word) : card ? card.lemma ?? lookupForm(at.word) : at.word;
  const shownMeaning = card?.meaning.source ? card.meaning.text : null;
  const lsjShort = l?.lsj ? otherDefinitions(l.lsj.entries, shownMeaning) : [];
  const full = whole === key;
  const credits = l ? creditsFor({ glaux: !!l.analysis || !!l.tree, lsj: !!l.lsj, core: card?.meaning.source === "core" }) : [];
  const occurs = l ? occursLine(l.occurs, workTitle) : null;

  const meaning = card && (
    <>
      {card.meaning.text}
      {card.meaning.source && <span className="visually-hidden"> (from {SOURCE_NAMES[card.meaning.source]})</span>}
    </>
  );

  return (
    <aside
      ref={ref} tabIndex={-1} data-lookup={place} data-layer={layer} aria-label={`Look-up: ${at.word}`}
      className={`${styles.lookup} ${place === "note" ? styles.note : styles.sheet}`}
      style={note ? { left: note.left, width: note.width } : undefined}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (layer === 2) onLayer(1); else onClose();
      }}
    >
      <div className={styles.head}>
        {layer === 2 && <button type="button" className={`text-btn ${styles.back}`} onClick={() => onLayer(1)}><Icon name="back" />Back</button>}
        <p className={styles.pw} lang="grc" style={{ "--chars": head.normalize("NFC").length } as React.CSSProperties}>{head}</p>
        <button type="button" className={`icon-btn ${styles.x}`} onClick={onClose}><Icon name="close" label="Close the look-up" /></button>
      </div>

      {/* (the sheet's body scrolls by itself: it is in the Tab order, so a keyboard can scroll it) */}
      <div className={styles.body} aria-live="polite" aria-busy={!l && !failed} tabIndex={place === "sheet" ? 0 : undefined}>
        {!l && !failed && <p className="muted">Looking it up…</p>}
        {failed && <p className="muted">The look-up could not be loaded ({got.error}). Check your connection and try the word again.</p>}

        {card && layer === 1 && (
          <section className={styles.card}>
            <p className={styles.kind}>{card.kind ? `${card.kind} · you tapped ` : "You tapped "}<span lang="grc">{at.word}</span></p>
            <p className={styles.meaning} title={card.meaning.source ? `From ${SOURCE_NAMES[card.meaning.source]}` : undefined}>{meaning}</p>
            {card.role && <p className={styles.role}>{card.role.lead}{card.role.governor && <> <span lang="grc">{card.role.governor}</span></>}.</p>}
            {card.grammar && <p className={`label ${styles.grammar}`}>{card.grammar}</p>}
            {unsure(l!) && <p className={styles.unsure}>{unsure(l!)}</p>}
          </section>
        )}

        {card && layer === 2 && (
          <div className={styles.second}>
            <div className={styles.recap}>
              {card.kind && <p className={styles.kind}>{card.kind}</p>}
              <p className={styles.recapMeaning}>{meaning}</p>
            </div>
            <section className={styles.sec}>
              <h3 className="label">In this passage</h3>
              {!l!.analysis && <p className="muted">{certaintyNote(null, l!.analysisError)}</p>}
              {l!.analysis && (() => {
                const p = readTag(l!.analysis.tag);
                return (
                  <>
                    <p><span lang="grc">{l!.analysis.lemma}</span> · <b>{p.pos}</b>{p.detail ? ` · ${p.detail}` : ""}</p>
                    <p className={styles.fine}>{certaintyNote(l!.analysis)} Analysis: GLAUx (Keersmaekers 2021), CC BY-SA 4.0.</p>
                  </>
                );
              })()}
            </section>
            <section className={styles.sec}>
              <h3 className="label">Dictionary · LSJ</h3>
              {!l!.lsj && <p className="muted">{l!.lsjError ? `The dictionary could not be loaded (${l!.lsjError}).` : "No LSJ entry found under this headword."}</p>}
              {l!.lsj && !full && lsjShort.map((e, i) => <p key={i}>{e.s}</p>)}
              {l!.lsj && (full || lsjShort.length === 0) && (
                <div ref={setPreview} className={styles.lsj} data-clip={full ? undefined : ""} data-clipped={!full && clipped ? "" : undefined}>
                  {l!.lsj.entries.map((e, i) => <Entry key={i} e={e} />)}
                </div>
              )}
              {l!.lsj && (full || lsjShort.length > 0 || clipped) && <button type="button" className={`text-btn ${styles.quietBtn}`} aria-expanded={full} onClick={() => setWhole(full ? "" : key)}><Icon name={full ? "chevron-up" : "chevron-down"} />{full ? "The short entry" : "The whole entry"}</button>}
            </section>
            {needWikt && (
              <section className={styles.sec}>
                <h3 className="label">Wiktionary · live</h3>
                {!w && <p className="muted">Looking it up…</p>}
                {w && !w.value && <p className="muted">{w.error ? `Wiktionary could not be reached (${w.error}).` : "No Wiktionary entry for this form."}</p>}
                {w?.value && (
                  <>
                    {[...w.value.senses, ...(w.value.lemmaSenses && w.value.senses.some((x) => x.lemma) ? w.value.lemmaSenses : [])].map((s, i) => (
                      <div key={i}><span className="label">{s.pos}</span>{s.lines.map((t, j) => <p key={j}>{t}</p>)}</div>
                    ))}
                    <p className={styles.fine}>From <a href={w.value.url} target="_blank" rel="noopener noreferrer">Wiktionary</a>, CC BY-SA 4.0.</p>
                  </>
                )}
              </section>
            )}
            {occurs && (
              <section className={styles.sec}>
                <h3 className="label">In this book</h3>
                <p>{occurs}</p>
              </section>
            )}
            <section className={styles.sec}>
              <h3 className="label">How sure</h3>
              <p className={styles.fine}>{certaintyNote(l!.analysis, l!.analysisError)}</p>
              {credits.length > 0 && <p className={styles.fine}>{credits.map((c) => c.text).join(". ")}.</p>}
            </section>
          </div>
        )}
      </div>

      {layer === 1 && (
        <div className={styles.row}>
          <button type="button" className={`text-btn ${styles.step}`} onClick={() => onStep(-1)} aria-label="Previous word"><Icon name="chevron-left" />Previous</button>
          <button type="button" className={`text-btn ${styles.step}`} onClick={() => onStep(1)} aria-label="Next word">Next<Icon name="chevron-right" /></button>
          <button type="button" className={`text-btn ${styles.step}`} onClick={onNote}><Icon name="note" />Note</button>
          <button type="button" className={`text-btn ${styles.more}`} onClick={() => onLayer(2)} disabled={!card}><Icon name="info" />More about it</button>
        </div>
      )}
    </aside>
  );
}
