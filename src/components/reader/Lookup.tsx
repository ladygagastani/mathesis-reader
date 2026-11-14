"use client";
/**
 * The word look-up (DESIGN.md, decision 1). On a wide enough window it is a panel that slides in from the right, clear of the Greek
 * (lib/lookup/placement.ts); otherwise a low sheet from the foot of the screen. The reader keeps the word in sight (Reader.tsx).
 * Layer one, in a learner's order: the dictionary form in its ring; one meaning with its source; this word where it stands (the
 * form as the text writes it, its grammar, what it does in the sentence where the treebank says, and a plain warning when the
 * analysis is not of this very word); the rest of the dictionary's heading and the kind of word; how common the word is. "Save
 * word" keeps the word for the Saved page (lib/notes/words.ts). "More about it" opens layer two in the same place: the word here,
 * Wiktionary's meanings, LSJ, the word's family, other dictionaries, how sure the analysis is and the credits. Nothing here is
 * composed: every line comes from a source or says plainly there is none.
 */
import Link from "next/link";
import Icon from "@/components/Icon";
import Ring from "@/components/Ring";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { candidates, fold, lookupForm } from "@/lib/greek";
import { couldNotLoad, SOURCE_NAMES, trimShort } from "@/lib/lookup/card";
import { spellOut } from "@/lib/lookup/abbrev";
import { classOf, fullHeading, rankLine } from "@/lib/lookup/core";
import { certaintyNote } from "@/lib/lookup/certainty";
import { creditsFor } from "@/lib/lookup/credits";
import { lookUp, lookUpHeadword, type Looked, type WordAt } from "@/lib/lookup/lookup";
import { citationHref, type LsjEntry, type Seg } from "@/lib/lookup/lsj";
import { grammarPhrases, readTag } from "@/lib/lookup/postag";
import { lookUpWiktionary, type WiktResult } from "@/lib/lookup/wiktionary";
import { wordFamily, type WordFamily } from "@/lib/lookup/wiktionary-family";
import { occursLine } from "@/lib/lookup/occurrences";
import type { LookupPlace } from "@/lib/lookup/placement";
import { otherDefinitions } from "@/lib/lookup/repeats";
import { newId } from "@/lib/notes/notes";
import { removeWord, saveWord, useWords } from "@/lib/notes/store";
import { savedOf } from "@/lib/notes/words";
import styles from "./Lookup.module.css";

/** LSJ's words. Where LSJ sends the reader to another entry ("v. εἴδω", "= ἴσθι", "cf. ἴδμεν"), that Greek word opens in the
 *  look-up, as a related word does: οἶδα's own entry is only "v. εἴδω B." (the critique of 2026-11-14). */
function Segs({ segs, onFollow }: { segs: Seg[]; onFollow?: (w: string) => void }) {
  return segs.map((s, i) => {
    // LSJ's "v." before a word it now opens is written out, "see", as the meanings' shorthand is (abbrev.ts)
    if (typeof s === "string") {
      const next = segs[i + 1];
      const sees = onFollow && next && typeof next !== "string" && "g" in next && /(?:^|\s)v\.\s*$/.test(s);
      return <span key={i}>{sees ? s.replace(/v\.(\s*)$/, "see$1") : s}</span>;
    }
    const before = segs[i - 1];
    if ("g" in s && onFollow && typeof before === "string" && /(?:^|\s)(?:v\.|=|cf\.)\s*$/.test(before)) {
      const w = s.g.replace(/[.,;·:]+$/u, "");
      // an inline link that acts as a button, straight in LSJ's line: a word inside a sentence, as LSJ's citations are (a
      // <button> is always drawn inline-block, so it could not stand in the line as one of its words)
      const open = (e: React.SyntheticEvent) => { e.preventDefault(); onFollow(w); };
      return (
        <Fragment key={i}>
          <a href="#" role="button" lang="grc" className={styles.kinWord} onClick={open} onKeyDown={(e) => { if (e.key === " ") open(e); }} title={`Look up ${w}`}>{w}</a>
          {s.g.slice(w.length) && <span lang="grc">{s.g.slice(w.length)}</span>}
        </Fragment>
      );
    }
    if ("g" in s) return <span key={i} lang="grc">{s.g}</span>;
    const href = citationHref(s.u);
    // LSJ runs a Greek word straight into the citation after it ("μήνιοςPl. R. 390e"): a space between them
    const prev = segs[i - 1];
    const gap = prev && typeof prev !== "string" && "g" in prev ? " " : "";
    return href ? <span key={i}>{gap}<Link href={href} className={styles.cite}>{s.c}</Link></span> : <span key={i}>{gap}{s.c}</span>;
  });
}

function Entry({ e, onFollow }: { e: LsjEntry; onFollow?: (w: string) => void }) {
  return e.b.map(([level, label, segs], i) => (
    <p key={i} style={{ paddingLeft: `${Math.max(0, level - 1) * 0.9}em` }}>
      {label && <b className={styles.senseN}>{label}.</b>} <Segs segs={segs} onFollow={onFollow} />
    </p>
  ));
}

/** The grammar, one phrase to a pill: "perfect active indicative", "1st person singular" (postag.ts, grammarPhrases). */
function Parts({ parts }: { parts: string[] }) {
  return <ul className={styles.parts} aria-label="Grammar">{parts.map((p, i) => <li key={i}>{p}</li>)}</ul>;
}

/** A dictionary's line with its shorthand written out in full (lib/lookup/abbrev.ts). */
function Spelled({ text }: { text: string }) {
  return <>{spellOut(text)}</>;
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

/** How many words of a family's list show before "Show all". */
const FIRST = 14;

/** Opens the rest of a family's list, or closes it again. */
function ShowAll({ open, rest, onToggle }: { open: boolean; rest: number; onToggle: () => void }) {
  return (
    <button type="button" className={`text-btn ${styles.quietBtn}`} aria-expanded={open} onClick={onToggle}>
      <Icon name={open ? "chevron-up" : "chevron-down"} />{open ? "Show fewer" : `Show ${rest} more`}
    </button>
  );
}

/** The core list's heading less the dictionary form it starts with, which the ring already shows: "ἀνήρ ἀνδρός, ὁ" under ἀνήρ
 *  is "ἀνδρός, ὁ"; "οἶδα, infinitive εἰδέναι" is "infinitive εἰδέναι". A heading that does not start with the form stays whole. */
function afterHead(heading: string, head: string): string | null {
  const m = /^(\S+?)[,\s]+(.*)$/u.exec(heading.trim());
  if (m && fold(m[1].replace(/[.,;·]+$/u, "")) === fold(head)) return m[2].trim() || null;
  return heading;
}

/** This word where it stands: the form as the text writes it with its grammar after it ("ἄνδρες  vocative plural"), what it
 *  does in the sentence, and a plain warning when the analysis is not of this very word. The grammar is words, not pills: the
 *  pills looked like the buttons under them and did nothing. An uncertain analysis is set fainter, so it does not look as sure. */
function Here({ form, parts, role, unsure, readAs }: {
  form: string; parts: string[]; role: { lead: string; governor: string | null } | null; unsure: string | null;
  readAs?: { lemma: string; pos: string } | null;
}) {
  return (
    <div className={styles.here} data-unsure={unsure ? "" : undefined}>
      <div className={styles.formLine}>
        <span lang="grc" className={styles.form} title="The word as it stands in the text">{form}</span>
        {parts.length > 0 && <Parts parts={parts} />}
      </div>
      {readAs && <p className={styles.role}>Read as a form of <span lang="grc" className={styles.gov}>{readAs.lemma}</span>, {readAs.pos}.</p>}
      {role && <p className={styles.role}>{role.lead}{role.governor && <> <span lang="grc" className={styles.gov}>{role.governor}</span></>}.</p>}
      {unsure && <p className={styles.unsure}>{unsure}</p>}
    </div>
  );
}

/** Under the dictionary form, as a dictionary prints it: the rest of the entry's heading, then the kind of word. */
function Entry1({ rest, kindLine }: { rest: string | null; kindLine: string | null }) {
  if (!rest && !kindLine) return null;
  return (
    <div className={styles.entry}>
      {rest && <p className={styles.heading} lang="grc"><Spelled text={rest} /></p>}
      {kindLine && <p className={styles.kind}>{kindLine}</p>}
    </div>
  );
}

/** A failed load in plain words: the browser's own message ("Failed to fetch") stays out of sight, in the line's title. */
function plainFailure(error: string | undefined): string {
  if (!error) return "the dictionaries did not answer";
  if (/fetch|network|load failed|connection/i.test(error)) return "the connection failed";
  if (/\(\d{3}\)/.test(error)) return "the server that holds them answered with an error";
  return "something went wrong on the way";
}

/** The look-up could not be loaded: what happened, in plain words, and a button to try again (the critique of 2026-11-14: it
 *  showed "(Failed to fetch)" in the italic of an uncertain note, with no way to try again but to tap the word once more). */
function Failure({ what, error, onRetry }: { what: string; error: string | undefined; onRetry: () => void }) {
  return (
    <div className={styles.failure} role="status">
      <p title={error}>{what} could not be loaded: {plainFailure(error)}.</p>
      <button type="button" className={`text-btn ${styles.retry}`} onClick={onRetry}><Icon name="sync" />Try again</button>
    </div>
  );
}

/** A plain line when the analysis shown is not of this very word (lookup/words.ts, Analysis.where). */
function unsure(l: Looked): string | null {
  if (!l.analysis || l.analysis.where === "here") return null;
  switch (l.analysis.where) {
    case "passage": return "Uncertain: matched to this passage, not to this exact word.";
    case "corpus": return "Uncertain: this is how the form is usually read in other texts.";
    case "parser": return "Uncertain: a parser's reading of the form alone, not of this sentence.";
    default: return "Uncertain: this is how the form is read elsewhere in the book.";
  }
}

export default function Lookup({ at, place, layer, onLayer, onStep, onClose, workTitle, book, takeFocus, onNote }: {
  at: WordAt;
  place: LookupPlace;
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
  // Try again: each press runs the loads once more (a failed load is not kept in the caches, lsj.ts and words.ts)
  const [tries, setTries] = useState(0);
  const [got, setGot] = useState<{ key: string; value: Looked | null; error?: string }>({ key: "", value: null });
  const [whole, setWhole] = useState("");
  useEffect(() => {
    let live = true;
    lookUp(at).then((value) => { if (live) setGot({ key, value }); }, (e: Error) => { if (live) setGot({ key, value: null, error: e.message }); });
    return () => { live = false; };
  }, [key, at, tries]);
  // the related words followed from the word family, in layer two: the last is the word shown, and Back goes one step down the trail
  const [trail, setTrail] = useState<{ key: string; words: string[] }>({ key: "", words: [] });
  const followed = trail.key === key ? trail.words : [];
  const seen = layer === 2 && followed.length > 0 ? followed[followed.length - 1] : null;
  const follow = (w: string) => setTrail({ key, words: [...followed, w] });
  // On a phone the sheet's second layer fills the screen (the owner, 2026-11-14), and the sheet slides between its heights: a
  // change of layer remembers where the sheet stood, and it slides from there once it has its new height. (Never on a computer's
  // panel, and not under reduced motion.)
  const slideFrom = useRef<number | null>(null);
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const goLayer = (to: 1 | 2) => {
    if (place === "sheet" && ref.current) slideFrom.current = ref.current.getBoundingClientRect().top;
    onLayer(to);
  };
  useLayoutEffect(() => {
    const el = ref.current, from = slideFrom.current;
    slideFrom.current = null;
    if (!el || from === null || place !== "sheet" || still()) return;
    const by = from - el.getBoundingClientRect().top;
    if (Math.abs(by) > 1) el.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
  }, [layer, place]);
  // Its head and handle drag it: down from the full screen back to the low sheet, down from the low sheet to close it, up from
  // the low sheet to More about it. Down follows the finger; up gives a little, against a spring. A short fast flick does as a
  // long drag does. Let go short of either, and it slides back.
  const drag = useRef<{ y: number; dy: number; t: number; v: number; id: number } | null>(null);
  const dragStart = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (place !== "sheet" || !el || e.button !== 0 || drag.current) return;
    const t = e.target as Element;
    const onHandle = t.closest("[data-drag]") || (t === el && e.clientY - el.getBoundingClientRect().top < 48);
    if (!onHandle || t.closest("button, a")) return;
    drag.current = { y: e.clientY, dy: 0, t: e.timeStamp, v: 0, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
  };
  const dragMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current, el = ref.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    d.v = (dy - d.dy) / Math.max(1, e.timeStamp - d.t); d.dy = dy; d.t = e.timeStamp;
    el.style.transform = `translateY(${dy >= 0 ? dy : layer === 1 ? dy / 3 : 0}px)`;
  };
  const dragEnd = (e: React.PointerEvent<HTMLElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    settle(d.dy, d.v, cancelled);
  };
  // where a drag ends: the full screen back to the low sheet, the low sheet closed or up to More about it, or back where it stood
  const settle = (dy: number, v: number, cancelled: boolean) => {
    const el = ref.current;
    if (!el) return;
    const down = !cancelled && (dy > 96 || (dy > 24 && v > 0.5));
    const up = !cancelled && layer === 1 && !!card && (dy < -48 || (dy < -16 && v < -0.5));
    const at = el.style.transform;
    if (down && layer === 2) { goLayer(1); el.style.transform = ""; return; }
    if (up) { goLayer(2); el.style.transform = ""; return; }
    if (down) {
      if (still()) { onClose(); return; }
      el.animate([{ transform: at }, { transform: "translateY(100%)" }], { duration: 200, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" }).finished.then(onClose, onClose);
      return;
    }
    el.style.transform = "";
    if (at && !still()) el.animate([{ transform: at }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
  };
  // A swipe down anywhere in the sheet's body does what a drag on its handle does (the owner, 2026-11-14: from More about it,
  // swipe from anywhere to bring back the compact look-up): only while the body is scrolled to its top, and only once the finger
  // moves more down than across, so a swipe up still scrolls and a swipe across still selects. Touch events, not pointer events:
  // the browser takes a pointer for its own scrolling and cancels it, and only a touchmove listener that is not passive can stop that.
  const bodyRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef(settle);
  useEffect(() => { settleRef.current = settle; });
  useEffect(() => {
    const body = bodyRef.current, el = ref.current;
    if (place !== "sheet" || !body || !el) return;
    let pull: { y: number; x: number; dy: number; t: number; v: number; on: boolean | null } | null = null;
    const start = (e: TouchEvent) => {
      pull = e.touches.length === 1 && body.scrollTop <= 0 && !drag.current
        ? { y: e.touches[0].clientY, x: e.touches[0].clientX, dy: 0, t: e.timeStamp, v: 0, on: null } : null;
    };
    const move = (e: TouchEvent) => {
      if (!pull) return;
      if (e.touches.length !== 1) { if (pull.on) { el.style.transform = ""; settleRef.current(0, 0, true); } pull = null; return; }
      const dy = e.touches[0].clientY - pull.y, dx = e.touches[0].clientX - pull.x;
      if (pull.on === null) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        pull.on = dy > 0 && dy > Math.abs(dx) && body.scrollTop <= 0;
        if (!pull.on) { pull = null; return; }
      }
      e.preventDefault();
      pull.v = (dy - pull.dy) / Math.max(1, e.timeStamp - pull.t); pull.dy = dy; pull.t = e.timeStamp;
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };
    const end = (e: TouchEvent) => {
      const p = pull;
      pull = null;
      if (p?.on) settleRef.current(p.dy, p.v, e.type === "touchcancel");
    };
    body.addEventListener("touchstart", start, { passive: true });
    body.addEventListener("touchmove", move, { passive: false });
    body.addEventListener("touchend", end);
    body.addEventListener("touchcancel", end);
    return () => {
      body.removeEventListener("touchstart", start);
      body.removeEventListener("touchmove", move);
      body.removeEventListener("touchend", end);
      body.removeEventListener("touchcancel", end);
    };
  }, [place]);
  // more under the fold of the sheet's body: its foot fades while there is (Lookup.module.css, data-more), after every change of
  // its words and as it scrolls
  useEffect(() => {
    const body = bodyRef.current;
    if (place !== "sheet" || !body) return;
    const measure = () => body.toggleAttribute("data-more", body.scrollHeight - body.scrollTop - body.clientHeight > 2);
    measure();
    body.addEventListener("scroll", measure, { passive: true });
    const watch = new ResizeObserver(measure);
    watch.observe(body);
    for (const c of body.children) watch.observe(c);
    return () => { body.removeEventListener("scroll", measure); watch.disconnect(); };
  });
  const back = () => {
    if (followed.length) setTrail({ key, words: followed.slice(0, -1) });
    else goLayer(1);
  };
  const lkey = seen ? `${key}|${seen}` : key;
  const [other, setOther] = useState<{ word: string; value: Looked | null; error?: string }>({ word: "", value: null });
  useEffect(() => {
    if (!seen) return;
    let live = true;
    lookUpHeadword(seen).then((value) => { if (live) setOther({ word: seen, value }); }, (e: Error) => { if (live) setOther({ word: seen, value: null, error: e.message }); });
    return () => { live = false; };
  }, [seen, tries]);
  useEffect(() => { if (takeFocus) ref.current?.focus({ preventScroll: true }); }, [takeFocus, key, layer]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [layer, lkey]);
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

  // the word shown: the word tapped, or the related word followed to
  const word = seen ?? at.word;
  // the word whose family it was followed from
  const from = !seen ? null : followed.length > 1 ? followed[followed.length - 2] : got.value?.card.lemma ?? lookupForm(at.word);
  const l = seen ? (other.word === seen ? other.value : null) : got.key === key ? got.value : null;
  const loadError = seen ? other.error : got.error;
  // Wiktionary, live, beside LSJ
  const [wikt, setWikt] = useState<{ key: string; value: WiktResult | null; error?: string }>({ key: "", value: null });
  const needWikt = layer === 2 && !!l;
  useEffect(() => {
    if (!needWikt) return;
    const ctl = new AbortController();
    // a word followed from a family is Wiktionary's own spelling: tried first, before LSJ's
    lookUpWiktionary([...new Set([...(seen ? [seen] : []), ...(l!.card.lemma ? [l!.card.lemma] : []), ...candidates(word)])], ctl.signal)
      .then((value) => setWikt({ key: lkey, value }))
      .catch((e: Error) => { if (!ctl.signal.aborted) setWikt({ key: lkey, value: null, error: e.message }); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needWikt, lkey]);
  const w = wikt.key === lkey ? wikt : null;
  // the word's family (etymology, Greek words built on it, English words from it), live, from the dictionary form; a word
  // followed from a family is already Wiktionary's own title
  const [family, setFamily] = useState<{ key: string; value: WordFamily | null }>({ key: "", value: null });
  const famTitle = l ? seen ?? l.card.lemma ?? lookupForm(at.word) : null;
  useEffect(() => {
    if (!needWikt || !famTitle) return;
    const ctl = new AbortController();
    wordFamily(famTitle, ctl.signal)
      .then((value) => setFamily({ key: lkey, value }))
      .catch(() => { if (!ctl.signal.aborted) setFamily({ key: lkey, value: null }); });
    return () => ctl.abort();
  }, [needWikt, famTitle, lkey]);
  const fam = family.key === lkey ? family.value : null;
  const kin = fam ? [...new Set([...fam.derived, ...fam.related])].filter((k) => fold(k) !== fold(famTitle ?? "")) : [];
  // the family's lists show their first words; "Show all" opens the rest (per word shown)
  const [allKin, setAllKin] = useState("");
  const [allEnglish, setAllEnglish] = useState("");
  const failed = !l && (seen ? other.word === seen : got.key === key);
  const card = l?.card ?? null;
  // the dictionaries could not be loaded, though the word's analysis was: the card says so, and More about it waits
  const dictsDown = !!card && couldNotLoad(card.meaning.text, [l!.lsjError, l!.coreError]);
  const retry = () => { setGot({ key: "", value: null }); setOther({ word: "", value: null }); setTries((n) => n + 1); };
  const head = seen ? seen : layer === 2 && l ? card?.lemma ?? l.lsj?.head ?? lookupForm(word) : card ? card.lemma ?? lookupForm(word) : at.word;
  const shownMeaning = card?.meaning.source ? card.meaning.text : null;
  const lsjShort = l?.lsj ? otherDefinitions(l.lsj.entries, shownMeaning) : [];
  const full = whole === lkey;
  const credits = l ? creditsFor({ glaux: (!!l.analysis && l.analysis.where !== "parser") || !!l.tree, parser: l.analysis?.where === "parser", lsj: !!l.lsj, core: !!l.core }) : [];
  const occurs = l ? occursLine(l.occurs, workTitle) : null;
  // the kind of word with the core list's class ("noun, masculine · 2nd declension"); the list's full heading and the part of it
  // after the dictionary form; the grammar one phrase to a part; and how common the word is
  const cls = card ? classOf(l!.core, card.kind) : null;
  const kindLine = card?.kind ? [card.kind, cls].filter(Boolean).join(" · ") : null;
  const heading = card ? fullHeading(l!.core, card.lemma ?? head) : null;
  const rest = heading ? afterHead(heading, head) : null;
  const parts = l?.analysis ? grammarPhrases(l.analysis.tag) : [];
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
      <Spelled text={card.meaning.text} />
      {card.meaning.source && <span className="visually-hidden"> (from {SOURCE_NAMES[card.meaning.source]})</span>}
    </>
  );

  return (
    <aside
      ref={ref} tabIndex={-1} data-lookup={place} data-layer={layer} aria-label={`Look-up: ${at.word}`}
      className={`${styles.lookup} ${place === "sheet" ? styles.sheet : styles.drawer}`}
      onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={(e) => dragEnd(e)} onPointerCancel={(e) => dragEnd(e, true)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (layer === 2) back(); else onClose();
      }}
    >
      {/* the sheet's handle, to drag it up or down (the buttons do the same: More about it, Back, ×) */}
      {place === "sheet" && <span className={styles.grab} data-drag="" aria-hidden="true" />}
      {/* in More about it, Back and × stand on a line of their own above the word, so the word keeps its place at the left as
          the layers change (it used to move right of Back), and only that line stays in sight as the panel scrolls */}
      {layer === 2 && (
        <div className={styles.nav} data-drag={place === "sheet" ? "" : undefined}>
          {!seen && <button type="button" className={`text-btn ${styles.back}`} onClick={back}><Icon name="back" />Back</button>}
          {from && <button type="button" className={`text-btn ${styles.back}`} onClick={back} aria-label={`Back to ${from}`}><Icon name="back" /><span lang="grc">{from}</span></button>}
          {/* Save word here too: More about it is where a reader decides to keep a word (the critique of 2026-11-14) */}
          {!seen && card && <button type="button" className={`text-btn ${styles.navSave}`} aria-pressed={!!saved} onClick={toggleSaved}
            title={saved ? "Saved: on the Saved page. Press to take it off." : "Keep this word on the Saved page"}><Icon name="keep" />{saved ? "Saved" : "Save word"}</button>}
          <button type="button" className={`icon-btn ${styles.x}`} onClick={onClose}><Icon name="close" label="Close the look-up" /></button>
        </div>
      )}
      <div className={styles.head} data-drag={place === "sheet" ? "" : undefined}>
        {/* the panel stands the word in its ring; the phone's sheet, short of room, sets it on a terracotta line instead, so the
            meaning and the buttons keep the sheet's height (owner's note, 2026-11-14) */}
        <p className={styles.pw} lang="grc" style={{ "--chars": head.normalize("NFC").length } as React.CSSProperties}>
          {place === "sheet"
            ? <span className={styles.under}><span>{head}</span></span>
            : <Ring kind="word" className={head.normalize("NFC").length <= 5 ? styles.round : undefined}>{head}</Ring>}
        </p>
        {layer === 1 && <button type="button" className={`icon-btn ${styles.x}`} onClick={onClose}><Icon name="close" label="Close the look-up" /></button>}
      </div>

      {/* (the sheet's body scrolls by itself: it is in the Tab order, so a keyboard can scroll it) */}
      {/* what a screen reader hears when a word opens or the arrows step to the next: the word and its meaning, once. The card
          itself is not a live region, so stepping word to word does not read the whole card again (the critique of 2026-11-14). */}
      <p className="visually-hidden" aria-live="polite">{failed || (card && couldNotLoad(card.meaning.text, [l!.lsjError, l!.coreError])) ? `${at.word}: the dictionaries could not be loaded.`
        : card && layer === 1 ? `${head}: ${spellOut(card.meaning.text)}` : ""}</p>
      <div ref={bodyRef} className={styles.body} aria-busy={!l && !failed} tabIndex={place === "sheet" ? 0 : undefined}>
        {/* while it loads, the card's shape in faint lines where the meaning and the grammar will stand, so nothing jumps when
            they arrive; the words "Looking it up" for a screen reader and for a slow connection */}
        {!l && !failed && (
          <div className={styles.waiting}>
            <span className={styles.ghost} data-w="long" /><span className={styles.ghost} data-w="short" />
            <p className={styles.waitWords}>Looking it up…</p>
          </div>
        )}
        {failed && <Failure what="The look-up" error={loadError} onRetry={retry} />}

        {/* Layer one answers a learner's questions in their order (the critique of 2026-11-14): what the word means, the largest
            English on the screen; what this form is, as it stands in the text, with its grammar and what it does in the sentence;
            then, quieter, the rest of the dictionary's heading and the kind of word; then how common it is. (Before, the kind of
            word in terracotta capitals, "you tapped", and the principal parts stood between the word and its meaning, and the
            grammar was three lines from the form it described.) */}
        {card && layer === 1 && (
          <section className={styles.card}>
            {dictsDown
              ? <Failure what="The dictionaries" error={l!.lsjError ?? l!.coreError} onRetry={retry} />
              : <p className={styles.meaning} data-long={spellOut(card.meaning.text).length > 34 || undefined} title={card.meaning.source ? `From ${SOURCE_NAMES[card.meaning.source]}` : undefined}>{meaning}</p>}
            <Here form={at.word} parts={parts} role={card.role} unsure={unsure(l!)} />
            <Entry1 rest={rest} kindLine={kindLine} />
            {facts.length > 0 && <p className={styles.facts}>{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
          </section>
        )}

        {/* More about it, in the order a reader needs it (the critique of 2026-11-14): this word here; its meanings in plain
            English (Wiktionary); the dictionary (LSJ), whose "v. εἴδω" now opens εἴδω; the word's family; the other sites; how sure
            the analysis is, with the credits, last. How common it is joins the summary at the top, as on the first layer. */}
        {card && layer === 2 && (
          <div className={styles.second}>
            <div className={styles.recap}>
              <p className={styles.recapMeaning}>{meaning}</p>
              <Entry1 rest={rest} kindLine={kindLine} />
              {facts.length > 0 && <p className={styles.facts}>{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
            </div>
            {from && <p className={styles.fine}>Related to <span lang="grc">{from}</span>. This word is not in the passage.</p>}
            {!seen && (
              <section className={styles.sec}>
                <h2 className="label">In this passage</h2>
                {l!.analysis
                  ? <Here form={at.word} parts={parts} role={card.role} unsure={unsure(l!)}
                      readAs={fold(l!.analysis.lemma) !== fold(head) ? { lemma: l!.analysis.lemma, pos: readTag(l!.analysis.tag).pos } : null} />
                  : <p className="muted">{certaintyNote(null, l!.analysisError)}</p>}
              </section>
            )}
            {needWikt && (
              <section className={styles.sec}>
                <h2 className="label">Meanings · Wiktionary</h2>
                {!w && <p className="muted">Looking it up…</p>}
                {w && !w.value && <p className="muted">{w.error ? `Wiktionary could not be reached: ${plainFailure(w.error)}.` : "Wiktionary has no entry for this word."}</p>}
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
            <section className={styles.sec}>
              <h2 className="label">Dictionary · LSJ</h2>
              {!l!.lsj && <p className="muted">{l!.lsjError ? `The dictionary could not be loaded: ${plainFailure(l!.lsjError)}.` : "LSJ has no entry under this headword."}</p>}
              {l!.lsj && !full && lsjShort.map((e, i) => <p key={i}>{trimShort(e.s)}</p>)}
              {l!.lsj && (full || lsjShort.length === 0) && (
                <div ref={setPreview} className={styles.lsj} data-clip={full ? undefined : ""} data-clipped={!full && clipped ? "" : undefined}>
                  {l!.lsj.entries.map((e, i) => <Entry key={i} e={e} onFollow={follow} />)}
                </div>
              )}
              {l!.lsj && (full || lsjShort.length > 0 || clipped) && <button type="button" className={`text-btn ${styles.quietBtn}`} aria-expanded={full} onClick={() => setWhole(full ? "" : lkey)}><Icon name={full ? "chevron-up" : "chevron-down"} />{full ? "The short entry" : "The whole entry"}</button>}
            </section>
            {fam && (fam.etymology.length > 0 || kin.length > 0 || fam.english.length > 0) && (
              <section className={styles.sec}>
                <h2 className="label">Word family · Wiktionary</h2>
                {kin.length > 0 && (
                  <div className={styles.kin}>
                    <p className={styles.wpos}>Related Greek words</p>
                    <ul className={styles.words} lang="grc" aria-label="Related Greek words">
                      {(allKin === lkey ? kin : kin.slice(0, FIRST)).map((k) => (
                        <li key={k}><button type="button" className={styles.kinWord} onClick={() => follow(k)} title={`Look up ${k}`}>{k}</button></li>
                      ))}
                    </ul>
                    {kin.length > FIRST && <ShowAll open={allKin === lkey} rest={kin.length - FIRST} onToggle={() => setAllKin(allKin === lkey ? "" : lkey)} />}
                  </div>
                )}
                {fam.english.length > 0 && (
                  <div className={styles.kin}>
                    <p className={styles.wpos}>English words from it</p>
                    <p className={styles.words}>{(allEnglish === lkey ? fam.english : fam.english.slice(0, FIRST)).map((k) => <span key={k}>{k}</span>)}</p>
                    {fam.english.length > FIRST && <ShowAll open={allEnglish === lkey} rest={fam.english.length - FIRST} onToggle={() => setAllEnglish(allEnglish === lkey ? "" : lkey)} />}
                  </div>
                )}
                {/* where the word comes from, after the words built on it: a learner meets its relatives before its roots */}
                {fam.etymology.length > 0 && (
                  <div className={styles.kin}>
                    <p className={styles.wpos}>Where it comes from</p>
                    {fam.etymology.slice(0, 2).map((t, i) => <p key={i} className={styles.etym}>{t}</p>)}
                  </div>
                )}
                <p className={styles.fine}>From <a href={fam.url} target="_blank" rel="noopener noreferrer">Wiktionary</a>, CC BY-SA 4.0.</p>
              </section>
            )}
            <section className={styles.sec}>
              <h2 className="label">Other dictionaries</h2>
              <ul className={styles.dicts}>
                <li><a href={`https://logeion.uchicago.edu/${encodeURIComponent(head)}`} target="_blank" rel="noopener noreferrer">Logeion<Icon name="outside" /></a> <span className={styles.fine}>LSJ, Middle Liddell, Autenrieth and more</span></li>
                <li><a href={`https://www.perseus.tufts.edu/hopper/morph?l=${encodeURIComponent(lookupForm(word))}&la=greek`} target="_blank" rel="noopener noreferrer">Perseus<Icon name="outside" /></a> <span className={styles.fine}>every way the form can be parsed</span></li>
              </ul>
              <p className={styles.fine}>These open on other sites, which then see the word.</p>
            </section>
            <section className={styles.sec}>
              <h2 className="label">How sure</h2>
              {!seen && <p className={styles.fine}>{certaintyNote(l!.analysis, l!.analysisError)}</p>}
              {credits.length > 0 && <p className={styles.fine}>{credits.map((c) => c.text).join(". ")}.</p>}
            </section>
          </div>
        )}
      </div>

      {layer === 1 && (
        <div className={styles.row}>
          {/* More about it, the one filled pill, across the panel; under it Note and Save word, and the arrows to the word before
              and after (the left and right keys do the same) */}
          <button type="button" className={`text-btn ${styles.more}`} onClick={() => goLayer(2)} disabled={!card || dictsDown}><Icon name="info" />More about it</button>
          <button type="button" className={`text-btn ${styles.act} ${styles.note}`} onClick={onNote}><Icon name="note" />Note</button>
          <button type="button" className={`text-btn ${styles.act} ${styles.keep}`} aria-pressed={!!saved} onClick={toggleSaved} disabled={!card}
            title={saved ? "Saved: on the Saved page. Press to take it off." : "Keep this word on the Saved page"}><Icon name="keep" />{saved ? "Saved" : "Save word"}</button>
          <button type="button" className={`text-btn ${styles.step} ${styles.prev}`} onClick={() => onStep(-1)} aria-label="Previous word" title="Previous word (←)"><Icon name="chevron-left" /></button>
          <button type="button" className={`text-btn ${styles.step} ${styles.next}`} onClick={() => onStep(1)} aria-label="Next word" title="Next word (→)"><Icon name="chevron-right" /></button>
        </div>
      )}
    </aside>
  );
}
