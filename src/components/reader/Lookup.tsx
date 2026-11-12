"use client";
/**
 * The word look-up (ADR 0009, decisions 1 and 4; DESIGN.md, decision 1). At 1100 px and wider it stands in the desk beside the text,
 * which stays put while the text scrolls (over the English column when Both leaves no room for the desk); below, a low sheet from the
 * foot of the screen, and the reader keeps the word above it (Reader.tsx).
 * Layer one: the dictionary form, the kind of word (with the core list's class) and the word tapped, the core list's full heading
 * (genitive and article, or principal parts), one meaning with its source, the grammar one word to a part, what the word does in
 * the sentence (only where the treebank says), a plain warning when the analysis is not of this very word, and how common the word
 * is; "Save word" keeps the word for the Saved page (lib/notes/words.ts). "More about it" opens layer two in the same place: the analysis, LSJ, Wiktionary's senses and the word's family, how common
 * the word is, how sure the analysis is, and the credits for what was shown. Nothing here is composed: every line comes from a source or says plainly there is none.
 */
import Link from "next/link";
import Icon from "@/components/Icon";
import { useEffect, useRef, useState } from "react";
import { candidates, fold, lookupForm } from "@/lib/greek";
import { SOURCE_NAMES } from "@/lib/lookup/card";
import { classOf, fullHeading, rankLine } from "@/lib/lookup/core";
import { certaintyNote } from "@/lib/lookup/certainty";
import { creditsFor } from "@/lib/lookup/credits";
import { lookUp, type Looked, type WordAt } from "@/lib/lookup/lookup";
import { citationHref, type LsjEntry, type Seg } from "@/lib/lookup/lsj";
import { grammarParts, readTag } from "@/lib/lookup/postag";
import { lookUpWiktionary, type WiktResult } from "@/lib/lookup/wiktionary";
import { wordFamily, type WordFamily } from "@/lib/lookup/wiktionary-family";
import { occursLine } from "@/lib/lookup/occurrences";
import type { LookupPlace } from "@/lib/lookup/placement";
import { otherDefinitions } from "@/lib/lookup/repeats";
import { newId } from "@/lib/notes/notes";
import { removeWord, saveWord, useWords } from "@/lib/notes/store";
import { savedOf } from "@/lib/notes/words";
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

/** The grammar, one word to a part, each set apart (postag.ts, grammarParts). */
function Parts({ parts }: { parts: string[] }) {
  return <ul className={styles.parts} aria-label="Grammar">{parts.map((p, i) => <li key={i}>{p}</li>)}</ul>;
}

/** Wiktionary's lines for one part of speech: the senses numbered, a line it indents (":") under its sense as an example. */
function WiktLines({ lines }: { lines: string[] }) {
  const senses: { text: string; notes: string[] }[] = [];
  for (const t of lines) {
    const ex = /^:+\s*(.*)$/.exec(t);
    if (ex && senses.length) senses[senses.length - 1].notes.push(ex[1]);
    else senses.push({ text: ex ? ex[1] : t, notes: [] });
  }
  return (
    <ol className={styles.wlist}>
      {senses.map((s, i) => <li key={i}>{s.text}{s.notes.map((n, j) => <span key={j} className={styles.wnote}>{n}</span>)}</li>)}
    </ol>
  );
}

/** A plain line when the analysis shown is not of this very word (lookup/words.ts, Analysis.where). */
function unsure(l: Looked): string | null {
  if (!l.analysis || l.analysis.where === "here") return null;
  return l.analysis.where === "passage" ? "Uncertain: matched to this passage, not to this exact word." : "Uncertain: this is how the form is read elsewhere in the book.";
}

export default function Lookup({ at, place, inDesk, over, layer, onLayer, onStep, onClose, workTitle, book, takeFocus, onNote }: {
  at: WordAt; place: LookupPlace;
  /** in the desk beside the text (DESIGN.md, decision 1) */
  inDesk: boolean;
  /** with no desk (Both on a narrower window): the English column's left edge and width, which the look-up stands over */
  over: { left: number; width: number } | null;
  layer: 1 | 2; onLayer: (l: 1 | 2) => void;
  onStep: (dir: 1 | -1) => void; onClose: () => void;
  workTitle: string;
  /** the book the word is met in, for a saved word: the reader's work id and the book's name */
  book: { work: string; name: string };
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
  // the word's family (etymology, Greek words built on it, English words from it), live, from the dictionary form
  const [family, setFamily] = useState<{ key: string; value: WordFamily | null }>({ key: "", value: null });
  const famTitle = l ? l.card.lemma ?? lookupForm(at.word) : null;
  useEffect(() => {
    if (!needWikt || !famTitle) return;
    const ctl = new AbortController();
    wordFamily(famTitle, ctl.signal)
      .then((value) => setFamily({ key, value }))
      .catch(() => { if (!ctl.signal.aborted) setFamily({ key, value: null }); });
    return () => ctl.abort();
  }, [needWikt, famTitle, key]);
  const fam = family.key === key ? family.value : null;
  const kin = fam ? [...new Set([...fam.derived, ...fam.related])].filter((k) => fold(k) !== fold(famTitle ?? "")) : [];
  const failed = got.key === key && !l;
  const card = l?.card ?? null;
  const head = layer === 2 && l ? card?.lemma ?? l.lsj?.head ?? lookupForm(at.word) : card ? card.lemma ?? lookupForm(at.word) : at.word;
  const shownMeaning = card?.meaning.source ? card.meaning.text : null;
  const lsjShort = l?.lsj ? otherDefinitions(l.lsj.entries, shownMeaning) : [];
  const full = whole === key;
  const credits = l ? creditsFor({ glaux: !!l.analysis || !!l.tree, lsj: !!l.lsj, core: !!l.core }) : [];
  const occurs = l ? occursLine(l.occurs, workTitle) : null;
  // the kind of word with the core list's class ("noun, masculine · 2nd declension"); the form tapped, where it is not the
  // dictionary form; the list's full heading; the grammar one word to a part; and how common the word is
  const cls = card ? classOf(l!.core, card.kind) : null;
  const kindLine = card?.kind ? [card.kind, cls].filter(Boolean).join(" · ") : null;
  const tapped = !!card && fold(lookupForm(at.word)) !== fold(head);
  const heading = card ? fullHeading(l!.core, card.lemma ?? head) : null;
  const parts = l?.analysis ? grammarParts(l.analysis.tag) : [];
  const facts = [occurs, l?.core ? rankLine(l.core.rank) : null].filter((x): x is string => !!x);
  // the word saved for later: by its dictionary form
  const words = useWords();
  const saved = card ? savedOf(words, head) : null;
  const toggleSaved = () => {
    if (!card) return;
    if (saved) { removeWord(saved.id); return; }
    saveWord({
      id: `w-${newId().slice(0, 16)}`, type: "word", lemma: head, form: at.word, kind: kindLine ?? "",
      meaning: card.meaning.source ? card.meaning.text : "", work: book.work, book: book.name, unit: at.unitKey,
    });
  };

  const meaning = card && (
    <>
      {card.meaning.text}
      {card.meaning.source && <span className="visually-hidden"> (from {SOURCE_NAMES[card.meaning.source]})</span>}
    </>
  );

  return (
    <aside
      ref={ref} tabIndex={-1} data-lookup={place} data-layer={layer} aria-label={`Look-up: ${at.word}`}
      className={`${styles.lookup} ${place === "sheet" ? styles.sheet : inDesk ? styles.desk : styles.note}`}
      style={place === "note" && !inDesk && over ? { left: over.left, width: over.width } : undefined}
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
            <p className={styles.kind}>
              {kindLine && <span className={styles.kindName}>{kindLine}</span>}
              {tapped && <span>{kindLine ? "you tapped " : "You tapped "}<span lang="grc" className={styles.tapped}>{at.word}</span></span>}
            </p>
            {heading && <p className={styles.heading} lang="grc">{heading}</p>}
            <p className={styles.meaning} title={card.meaning.source ? `From ${SOURCE_NAMES[card.meaning.source]}` : undefined}>{meaning}</p>
            {parts.length > 0 && <Parts parts={parts} />}
            {card.role && <p className={styles.role}>{card.role.lead}{card.role.governor && <> <span lang="grc" className={styles.gov}>{card.role.governor}</span></>}.</p>}
            {unsure(l!) && <p className={styles.unsure}>{unsure(l!)}</p>}
            {facts.length > 0 && <p className={styles.facts}>{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
          </section>
        )}

        {card && layer === 2 && (
          <div className={styles.second}>
            <div className={styles.recap}>
              {kindLine && <p className={styles.kind}><span className={styles.kindName}>{kindLine}</span></p>}
              {heading && <p className={styles.heading} lang="grc">{heading}</p>}
              <p className={styles.recapMeaning}>{meaning}</p>
            </div>
            <section className={styles.sec}>
              <h3 className="label">In this passage</h3>
              {!l!.analysis && <p className="muted">{certaintyNote(null, l!.analysisError)}</p>}
              {l!.analysis && (() => {
                const p = readTag(l!.analysis.tag);
                return (
                  <>
                    {/* the analysis's own dictionary form only where it is not the one at the top */}
                    {fold(l!.analysis.lemma) !== fold(head) && <p><span lang="grc" className={styles.gov}>{l!.analysis.lemma}</span> · {p.pos}</p>}
                    {parts.length > 0 && <Parts parts={parts} />}
                    {card.role && <p>{card.role.lead}{card.role.governor && <> <span lang="grc" className={styles.gov}>{card.role.governor}</span></>}.</p>}
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
            <section className={styles.sec}>
              <h3 className="label">Other dictionaries</h3>
              <ul className={styles.dicts}>
                <li><a href={`https://logeion.uchicago.edu/${encodeURIComponent(head)}`} target="_blank" rel="noopener noreferrer">Logeion<Icon name="outside" /></a> <span className={styles.fine}>LSJ, Middle Liddell, Autenrieth and more</span></li>
                <li><a href={`https://www.perseus.tufts.edu/hopper/morph?l=${encodeURIComponent(lookupForm(at.word))}&la=greek`} target="_blank" rel="noopener noreferrer">Perseus<Icon name="outside" /></a> <span className={styles.fine}>every way the form can be parsed</span></li>
              </ul>
              <p className={styles.fine}>These open on other sites, which then see the word.</p>
            </section>
            {needWikt && (
              <section className={styles.sec}>
                <h3 className="label">Wiktionary · live</h3>
                {!w && <p className="muted">Looking it up…</p>}
                {w && !w.value && <p className="muted">{w.error ? `Wiktionary could not be reached (${w.error}).` : "No Wiktionary entry for this form."}</p>}
                {w?.value && (
                  <>
                    {[...w.value.senses, ...(w.value.lemmaSenses && w.value.senses.some((x) => x.lemma) ? w.value.lemmaSenses : [])].map((s, i) => (
                      <div key={i} className={styles.wsense}>
                        <p className={styles.wpos}>{s.pos}</p>
                        <WiktLines lines={s.lines} />
                      </div>
                    ))}
                    <p className={styles.fine}>From <a href={w.value.url} target="_blank" rel="noopener noreferrer">Wiktionary</a>, CC BY-SA 4.0.</p>
                  </>
                )}
              </section>
            )}
            {fam && (fam.etymology.length > 0 || kin.length > 0 || fam.english.length > 0) && (
              <section className={styles.sec}>
                <h3 className="label">Word family · Wiktionary</h3>
                {fam.etymology.slice(0, 2).map((t, i) => <p key={i} className={styles.etym}>{t}</p>)}
                {kin.length > 0 && (
                  <div className={styles.kin}>
                    <p className={styles.wpos}>Related Greek words</p>
                    <p className={styles.words} lang="grc">{kin.slice(0, 14).map((k) => <span key={k}>{k}</span>)}{kin.length > 14 && <span lang="en" className={styles.moreN}>and {kin.length - 14} more</span>}</p>
                  </div>
                )}
                {fam.english.length > 0 && (
                  <div className={styles.kin}>
                    <p className={styles.wpos}>English words from it</p>
                    <p className={styles.words}>{fam.english.slice(0, 14).map((k) => <span key={k}>{k}</span>)}</p>
                  </div>
                )}
                <p className={styles.fine}>From <a href={fam.url} target="_blank" rel="noopener noreferrer">Wiktionary</a>, CC BY-SA 4.0.</p>
              </section>
            )}
            {(occurs || l!.core) && (
              <section className={styles.sec}>
                <h3 className="label">How common</h3>
                {occurs && <p>{occurs}.</p>}
                {l!.core && <p>{rankLine(l!.core.rank)}{l!.core.group ? <>, listed under <i>{l!.core.group}</i></> : ""}.</p>}
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
          <button type="button" className={`text-btn ${styles.step} ${styles.keep}`} aria-pressed={!!saved} onClick={toggleSaved} disabled={!card}
            title={saved ? "Saved: on the Saved page. Press to take it off." : "Keep this word on the Saved page"}><Icon name="keep" />{saved ? "Saved" : "Save word"}</button>
          <button type="button" className={`text-btn ${styles.more}`} onClick={() => onLayer(2)} disabled={!card}><Icon name="info" />More about it</button>
        </div>
      )}
    </aside>
  );
}
