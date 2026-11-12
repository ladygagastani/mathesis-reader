"use client";
/**
 * The reader (ADR 0009, "the quiet desk"): a book opens on its text under a one-line title (its title page only the first time it is
 * opened on this device); the Greek stands alone, each passage with "Show the English"; Aa offers Both and English for the whole book.
 * A click, a tap, or Enter on a Greek word opens the look-up; the arrow keys go from word to word. The address says the book and
 * the page (/read?w=tlg0059.tlg002&p=2), and "at" opens the page holding a passage (&at=17).
 * Notes (SPEC.md, "Notes and Saved"): "Note" in the look-up writes one on the word, its line or its passage; the foot bar's Notes
 * lists the book's notes; marks at the right edge jump to them. "&note=<id>" opens a note (the Saved page links that way).
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadAuthorNames, titleCaps } from "@/lib/authors";
import { describe } from "@/lib/catalog";
import { lookupPlace, type LookupPlace } from "@/lib/lookup/placement";
import type { WordAt } from "@/lib/lookup/lookup";
import { openBook, SyncFirst, type Book } from "@/lib/reader/book";
import type { Columns } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import { shown, type Anchor, type Note } from "@/lib/notes/notes";
import { useNotes } from "@/lib/notes/store";
import { alignChunk, type Row } from "@/lib/tei/align";
import { chunkOf, findRef } from "@/lib/tei/refs";
import Icon from "@/components/Icon";
import { Blocks } from "./Blocks";
import ReaderBar from "./ReaderBar";
import Lookup from "./Lookup";
import NoteEditor, { type Editing } from "./NoteEditor";
import NoteMarks, { locate } from "./NoteMarks";
import { placeName } from "@/lib/notes/notes";
import styles from "./Reader.module.css";

const OPENED = "mathesis-reader:opened";

/** Is this the first time this book is opened on this device? Marks it opened, and keeps the answer for this visit. */
const firstTimes = new Map<string, boolean>();
function firstOpening(work: string): boolean {
  if (!firstTimes.has(work)) firstTimes.set(work, markOpened(work));
  return firstTimes.get(work)!;
}
function markOpened(work: string): boolean {
  try {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(OPENED) ?? "[]"));
    if (seen.has(work)) return false;
    seen.add(work);
    localStorage.setItem(OPENED, JSON.stringify([...seen]));
    return true;
  } catch { return false; }
}

/** The word under a click or a key: its passage, its number among the passage's words, and how many of its spelling come before it. */
function wordAt(el: HTMLElement, work: string, doc: Book["doc"]): WordAt | null {
  const unit = el.closest<HTMLElement>("[data-u]");
  if (!unit) return null;
  const all = [...unit.querySelectorAll<HTMLElement>(`.${styles.w}`)];
  const i = all.indexOf(el);
  const word = el.textContent ?? "";
  const same = (x: HTMLElement) => (x.textContent ?? "").normalize("NFC") === word.normalize("NFC");
  return { work, word, unitKey: unit.dataset.u!, i, occurrence: all.slice(0, i).filter(same).length, doc };
}

/** What a note on the word looked up can stand on: the word, its line of verse if it is in one, and its passage. */
function anchorsAt(el: HTMLElement, at: WordAt): Anchor[] {
  const out: Anchor[] = [{ kind: "word", unit: at.unitKey, i: at.i, word: at.word }];
  const unit = el.closest<HTMLElement>("[data-u]");
  const line = el.closest<HTMLElement>(`.${styles.line}`);
  if (unit && line) {
    const lines = [...unit.querySelectorAll<HTMLElement>(`.${styles.line}`)];
    out.push({ kind: "line", unit: at.unitKey, line: lines.indexOf(line), lines: lines.length });
  }
  out.push({ kind: "passage", unit: at.unitKey });
  return out;
}

/** The title page's author: the Greek name in capitals where Wikidata gives one (the old title page's), the English name otherwise. */
function AuthorCaps({ id, name }: { id: string; name: string }) {
  const [grc, setGrc] = useState<{ id: string; name: string | null }>({ id: "", name: null });
  useEffect(() => {
    let live = true;
    loadAuthorNames().then((n) => { if (live) setGrc({ id, name: n[id]?.grc ?? null }); });
    return () => { live = false; };
  }, [id]);
  const greek = grc.id === id ? grc.name : null;
  return (
    <p className={styles.tpAu}>
      {greek ? <><span lang="grc" aria-hidden="true">{titleCaps(greek)}</span><span className="visually-hidden">{name}</span></> : name}
    </p>
  );
}

const RowView = memo(function RowView({ row, cols, open, onToggle, credit }: {
  row: Row; cols: Columns; open: boolean; onToggle: (key: string) => void; credit: string | null;
}) {
  const english = row.trans.length > 0;
  if (!row.greek.length && cols === "greek") return null;   // English the Greek has no place for shows only beside it
  return (
    <section className={styles.row} id={`p-${row.key}`} aria-label={`Passage ${row.key}`}>
      <div className={styles.ref} aria-hidden="true">{row.greek.length ? row.key : ""}</div>
      <div className={styles.grc} lang="grc">
        {row.greek.map((u, k) => (
          <div key={k} data-u={u.ref.join(".")}><Blocks blocks={u.blocks} greek margin={k === 0 ? row.key : undefined} /></div>
        ))}
        {cols === "greek" && english && (
          <div className={styles.oneBox} lang="en">
            <button type="button" className={`text-btn ${styles.oneBtn}`} aria-expanded={open} onClick={() => onToggle(row.key)}>
              {open ? "Hide the English" : "Show the English"}
            </button>
            {open && (
              <div className={styles.one} data-reading="">
                <Blocks blocks={row.trans} greek={false} />
                {credit && <p className={styles.oneCredit}>{credit}</p>}
              </div>
            )}
          </div>
        )}
      </div>
      {cols !== "greek" && (
        <div className={styles.tr} lang="en" data-reading="">
          {english ? <Blocks blocks={row.trans} greek={false} margin={row.greek.length ? row.key : undefined} /> :!row.cont && <span className={styles.untr}>This translation has no English for this passage.</span>}
        </div>
      )}
    </section>
  );
});

export default function Reader() {
  const params = useSearchParams();
  const router = useRouter();
  const workId = params.get("w") ?? "";
  const { columns } = useSettings();
  const [got, setGot] = useState<{ id: string; book?: Book; error?: string; syncFirst?: boolean }>({ id: "" });
  const [english, setEnglish] = useState<{ page: string; open: Set<string> }>({ page: "", open: new Set() });
  const [chosen, setWord] = useState<{ el: HTMLElement; at: WordAt; keyboard: boolean; page: string } | null>(null);
  const [layer, setLayer] = useState<1 | 2>(1);
  const [place, setPlace] = useState<LookupPlace>("note");
  // the look-up in the desk beside the text, or (Both on a window too narrow for the desk) over the English column
  const [deskOn, setDeskOn] = useState(true);
  const [over, setOver] = useState<{ left: number; width: number } | null>(null);
  const [editing, setEditing] = useState<{ e: Editing; page: string; back: HTMLElement | null } | null>(null);
  const allNotes = useNotes();

  useEffect(() => {
    if (!workId) return;
    let live = true;
    openBook(workId).then((book) => { if (live) setGot({ id: workId, book }); }, (e: Error) => { if (live) setGot({ id: workId, error: e.message, syncFirst: e instanceof SyncFirst }); });
    return () => { live = false; };
  }, [workId]);

  const book = got.id === workId ? got.book ?? null : null;
  const doc = book?.doc ?? null;
  const atRef = params.get("at");
  const page = useMemo(() => {
    if (!doc) return 0;
    const p = Number(params.get("p"));
    if (p >= 1 && p <= doc.chunks.length) return p - 1;
    const u = atRef ? findRef(doc, atRef) : -1;
    return u >= 0 ? chunkOf(doc, u) : 0;
  }, [doc, params, atRef]);
  const rows = useMemo(() => (doc && book ? alignChunk(doc, doc.chunks[page], book.placed) : []), [doc, book, page]);
  const pageKey = `${workId}|${page}`;
  const openEnglish = english.page === pageKey ? english.open : null;
  const toggleEnglish = useCallback((key: string) => setEnglish((e) => {
    const open = new Set(e.page === pageKey ? e.open : []);
    if (open.has(key)) open.delete(key); else open.add(key);
    return { page: pageKey, open };
  }), [pageKey]);
  // the word looked up, on this page only: a new page lets it go
  const word = chosen?.page === pageKey ? chosen : null;
  const edit = editing?.page === pageKey ? editing : null;
  // this book's notes, in the order of the book
  const notes = useMemo(() => {
    if (!doc) return [];
    const at = (n: Note) => findRef(doc, n.anchor.unit) * 1e4 + (n.anchor.kind === "word" ? n.anchor.i : n.anchor.kind === "line" ? n.anchor.line : -1);
    return shown(allNotes).filter((n) => n.work === workId).sort((a, b) => at(a) - at(b));
  }, [allNotes, doc, workId]);

  const close = useCallback((refocus = false) => {
    setWord((w) => { if (w) { w.el.removeAttribute("aria-current"); if (refocus) w.el.focus(); } return null; });
    setLayer(1);
  }, []);
  const choose = useCallback((el: HTMLElement, keyboard: boolean) => {
    if (!book) return;
    const at = wordAt(el, book.lookupWork, book.doc);
    if (!at) return;
    setEditing(null);
    setWord((w) => { w?.el.removeAttribute("aria-current"); return { el, at, keyboard, page: pageKey }; });
    el.setAttribute("aria-current", "true");
    setLayer(1);
  }, [book, pageKey]);
  const closeNote = useCallback((refocus: boolean) => {
    setEditing((e) => { if (refocus) e?.back?.focus({ preventScroll: true }); return null; });
  }, []);
  const openNote = useCallback((n: Note, el: HTMLElement) => {
    close();
    el.scrollIntoView({ block: lookupPlace(innerWidth) === "sheet" ? "start" : "center" });
    const back = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setEditing({ e: { note: n }, page: pageKey, back });
  }, [close, pageKey]);
  const noteWord = () => {
    if (!word) return;
    const anchors = anchorsAt(word.el, word.at);
    const back = word.el;
    close();
    setEditing({ e: { anchors }, page: pageKey, back });
  };
  const words = () => [...document.querySelectorAll<HTMLElement>(`main .${styles.w}`)];
  const step = (dir: 1 | -1) => {
    if (!word) return;
    const all = words();
    const next = all[all.indexOf(word.el) + dir];
    if (next) choose(next, word.keyboard);
  };

  // a new page, or a passage asked for: to its top
  useEffect(() => {
    if (!doc) return;
    const target = atRef ? document.getElementById(`p-${doc.units[findRef(doc, atRef)]?.ref.join(".")}`) : null;
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  }, [doc, page, atRef]);

  // "&note=<id>": the note opened, once, when its page is shown
  const noteParam = params.get("note");
  const opened = useRef("");
  useEffect(() => {
    if (!noteParam || opened.current === `${pageKey}|${noteParam}`) return;
    const n = notes.find((x) => x.id === noteParam);
    const el = n && locate(n.anchor);
    // (it needs the page drawn, to find the note's place in it: so after this render, not during it)
    if (n && el) { opened.current = `${pageKey}|${noteParam}`; queueMicrotask(() => openNote(n, el)); }
  }, [noteParam, notes, pageKey, openNote]);

  // the look-up's place: the desk beside the text; over the English column when Both leaves no room for the desk; or the sheet
  useLayoutEffect(() => {
    const measure = () => {
      const p = lookupPlace(window.innerWidth);
      setPlace(p);
      const desk = document.querySelector<HTMLElement>("[data-desk]");
      const on = p === "note" && !!desk && getComputedStyle(desk).display !== "none";
      setDeskOn(on);
      const tr = p === "note" && !on ? document.querySelector<HTMLElement>(`main .${styles.tr}`) : null;
      const r = tr?.getBoundingClientRect();
      setOver(r && r.width > 0 ? { left: r.left, width: r.width } : null);
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [rows, columns]);

  // the word stays in sight, never under the look-up: above the sheet (as the sheet grows when its words arrive, too), or, with the
  // desk, inside the screen below the bar
  useLayoutEffect(() => {
    const panel = document.querySelector<HTMLElement>("[data-lookup]");
    if (!word || !panel) return;
    const keepClear = () => {
      const r = word.el.getBoundingClientRect();
      const bar = document.querySelector("[data-reader-bar]")?.getBoundingClientRect().bottom ?? 0;
      const bottom = place === "sheet" ? panel.getBoundingClientRect().top : innerHeight;
      const room = 16;
      if (r.bottom > bottom - room) window.scrollBy({ top: r.bottom - bottom + room + (place === "sheet" ? r.height : 0) });
      else if (r.top < bar + room) window.scrollBy({ top: r.top - bar - room * 4 });
    };
    keepClear();
    const watch = new ResizeObserver(keepClear);
    watch.observe(panel);
    return () => watch.disconnect();
  }, [word, layer, place]);

  if (!workId) {
    return (
      <main id="main" className={`wrap ${styles.status}`}>
        <p>No book is chosen.</p>
        <Link className="btn" href="/">Go to the library</Link>
      </main>
    );
  }
  if (got.id === workId && got.syncFirst) {
    return (
      <main id="main" className={`wrap ${styles.status}`}>
        <p>This is one of your private texts. Sync this device to open it.</p>
        <Link className="btn" href={`/sync?next=${encodeURIComponent(`/read?w=${workId}`)}`}><Icon name="sync" />Sync this device</Link>
      </main>
    );
  }
  if (got.id === workId && got.error) {
    return (
      <main id="main" className={`wrap ${styles.status}`}>
        <p>This book could not be opened. {got.error}</p>
        <div><button type="button" className="btn" onClick={() => location.reload()}>Try again</button> <Link className="btn ghost" href="/">Library</Link></div>
      </main>
    );
  }
  if (!book || !doc) {
    return <main id="main" className={`wrap ${styles.status}`} aria-busy="true"><p className="muted">Opening the book…</p></main>;
  }

  const chunk = doc.chunks[page];
  const greekTitle = book.grc.label && /[Ͱ-Ͽἀ-῿]/.test(book.grc.label) ? book.grc.label : null;
  // (a private text's English is the owner's own, or the published one it carries: no Perseus credit)
  const credit = book.tr && !book.private ? `English: ${describe(book.tr, book.work.texts)}, Perseus Digital Library, CC BY-SA 4.0.` : null;
  const sheetOpen = (!!word || !!edit) && place === "sheet";
  const bookName = `${book.author.name}, ${book.work.title}`;
  const fromMenu = (n: Note) => {
    const el = locate(n.anchor);
    if (el) openNote(n, el);
    else router.push(`/read?w=${encodeURIComponent(workId)}&at=${encodeURIComponent(n.anchor.unit)}&note=${n.id}`);
  };

  const onText = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(`.${styles.w}`);
    if (el) choose(el, false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(`.${styles.w}`);
    if (!el) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(el, true); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const all = words();
      const next = all[all.indexOf(el) + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) { el.tabIndex = -1; next.tabIndex = 0; next.focus(); }
    }
    if (e.key === "Escape" && word) close(true);
  };
  const go = (i: number) => router.push(`/read?w=${encodeURIComponent(workId)}&p=${i + 1}`);

  const titlePage = page === 0 && firstOpening(workId);
  const barTitle = (
    <>
      {greekTitle && <><span lang="grc" className={styles.barGr}>{greekTitle}</span><span aria-hidden="true"> · </span></>}
      {book.author.name}, {book.work.title}
      {book.private && <span className={styles.lock}><Icon name="lock" label="Only you can see this" /></span>}
    </>
  );
  // the units of this page, for the notes the desk lists
  const here = new Set(rows.flatMap((r) => r.greek.map((u) => u.ref.join("."))));
  const pageNotes = notes.filter((n) => here.has(n.anchor.unit));
  const lookup = word && (
    <Lookup at={word.at} place={place} inDesk={deskOn} over={over} layer={layer} onLayer={setLayer} onStep={step} onClose={() => close(true)}
      workTitle={book.work.title} takeFocus={word.keyboard} onNote={noteWord} />
  );
  const editor = edit && (
    <NoteEditor key={"note" in edit.e ? edit.e.note.id : "new"} editing={edit.e} work={workId} book={bookName} place={place} inDesk={deskOn} over={over} onClose={closeNote} />
  );

  return (
    <main id="main" className={styles.reader} data-screen="reader" data-cols={book.tr ? columns : "greek"} data-sheet={sheetOpen || undefined}>
      <ReaderBar title={barTitle} showTitle={!titlePage} where={chunk.label} at={`page ${page + 1} of ${doc.chunks.length}`}
        pages={doc.chunks.map((c) => c.label)} page={page} onPage={go} hasEnglish={!!book.tr} notes={notes} onNote={fromMenu} />

      {titlePage && (
        <header className={`${styles.tp} enter`}>
          <AuthorCaps id={book.author.id} name={book.author.name} />
          <h1 className={styles.tpTitle}>{greekTitle ? <span lang="grc">{greekTitle}</span> : book.work.title}</h1>
          {greekTitle && <p className={styles.tpEn}>{book.work.title}</p>}
          <p className={styles.orn} aria-hidden="true">❦</p>
          {book.private && <p className={styles.tpPrivate}><Icon name="lock" />Only you can see this</p>}
          <p className={styles.tpEd}>
            <span className={styles.edKind}>Greek</span> {describe(book.grc, book.work.texts)}
            {book.tr && <> · <span className={styles.edKind}>English</span> {describe(book.tr, book.work.texts)}</>}
          </p>
        </header>
      )}

      <div className={styles.layout}>
        <div className={styles.column}>
          <div className={`${styles.text} enter`} onClick={onText} onKeyDown={onKey}>
            <span data-greek-probe="" lang="grc" className={styles.grc} hidden />
            {rows.map((r) => (
              <RowView key={r.key} row={r} cols={book.tr ? columns : "greek"} open={!!openEnglish?.has(r.key)} onToggle={toggleEnglish} credit={credit} />
            ))}
          </div>

          <nav className={styles.bottom} aria-label="Pages">
            <span className={styles.hint}>{chunk.label}</span>
            <div className={styles.bottomGo}>
              {page > 0 && <button type="button" className="btn ghost" onClick={() => go(page - 1)}><Icon name="back" />{doc.chunks[page - 1].label}</button>}
              {page < doc.chunks.length - 1 && <button type="button" className="btn" onClick={() => go(page + 1)}>Continue to {doc.chunks[page + 1].label}<Icon name="next" /></button>}
            </div>
          </nav>
        </div>

        {/* the desk (DESIGN.md, decision 1): the look-up, a note being written, or, with neither, this page's notes and how to look up */}
        <aside className={styles.desk} data-desk="" aria-label="The desk">
          {deskOn && (lookup || editor)}
          {deskOn && !lookup && !editor && (
            <div className={styles.idle}>
              <p className={styles.idleHint}>Click a Greek word to see its meaning here. With the keyboard: Tab into the text, the arrow keys to move, Enter to look up.</p>
              {pageNotes.length > 0 && (
                <section className={styles.idleNotes} aria-labelledby="desk-notes">
                  <h2 id="desk-notes" className="label">Notes on this page</h2>
                  <ol>
                    {pageNotes.map((n) => (
                      <li key={n.id}>
                        <button type="button" className={styles.idleNote} data-colour={n.colour} onClick={() => fromMenu(n)}>
                          <span className={styles.idlePlace}>{placeName(n.anchor)}</span>
                          <span className={styles.idleText}>{n.text}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}
        </aside>
      </div>

      <NoteMarks notes={notes} layout={[rows, columns, openEnglish]} onOpen={openNote} />

      {!deskOn && lookup}
      {!deskOn && editor}
    </main>
  );
}
