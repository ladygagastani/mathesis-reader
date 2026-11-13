"use client";
/**
 * The reader's bar along the top (DESIGN.md, decision 4): Library at the left, the book's title (which takes you to the top of the
 * page), where you are (which opens Go to: a passage by its reference, a word anywhere in the book, the pages), Notes, Text and the
 * keys at the right. It stays at the top of the window while the text scrolls. A menu drops from its button as a leaf of paper; it
 * takes the focus when it opens, Escape or × closes it, and the focus goes back to the button that opened it. The reader can open
 * a menu from the keyboard (`ask`: g for Go to, ? for the keys).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Found } from "@/lib/reader/find";
import Icon from "@/components/Icon";
import { GREEK_SIZES, LEADINGS, setSettings, stepLeading, stepSize, type Columns, type Theme } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import type { Note } from "@/lib/notes/notes";
import NotesMenu from "./NotesMenu";
import styles from "./ReaderBar.module.css";

export type Open = "" | "aa" | "pages" | "notes" | "keys";

/** A text to choose in Text: its version ("perseus-grc2", or "none") and how it is named ("Burnet, 1905"). */
export interface TextOption { value: string; label: string }

/** The keys, as the Keys menu lists them. */
const KEYS: [keys: string[], what: string][] = [
  [["←", "→"], "The page before, the page after. With a word looked up: the word before, the word after."],
  [["g"], "Go to a passage, or find a word anywhere in the book."],
  [["Tab"], "Into the text, then ← → from word to word, ↑ ↓ from line to line, Home and End to the first and last word."],
  [["Enter"], "Look up the word."],
  [["Esc"], "Close the look-up or a menu."],
  [["/"], "Search the library, from any page."],
  [["?"], "These keys."],
];

/** Go to: a passage by its reference, and a word anywhere in the book. */
function GoTo({ example, goTo, find, onFound, onDone }: {
  example: string; goTo: (ref: string) => string | null; find: (q: string) => Found[]; onFound: (f: Found, q: string) => void; onDone: () => void;
}) {
  const [ref, setRef] = useState("");
  const [wrong, setWrong] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; list: Found[] } | null>(null);
  const count = (f: { q: string; list: Found[] }) => !f.list.length ? `No passage has "${f.q.trim()}".`
    : f.list.length >= 100 ? "The first 100 passages:" : `${f.list.length} ${f.list.length === 1 ? "passage" : "passages"}:`;
  return (
    <>
      <form className={styles.field} onSubmit={(e) => { e.preventDefault(); const bad = goTo(ref); setWrong(bad ?? ""); if (!bad) onDone(); }}>
        <label className="label" htmlFor="goto-ref">Passage</label>
        <div className={styles.inline}>
          <input id="goto-ref" className={styles.input} value={ref} onChange={(e) => { setRef(e.target.value); setWrong(""); }} placeholder={`a reference, as ${example}`}
            autoComplete="off" spellCheck={false} aria-describedby="goto-wrong" />
          <button type="submit" className="btn ghost">Go<Icon name="next" /></button>
        </div>
        <p id="goto-wrong" className={styles.wrong} role="alert">{wrong}</p>
      </form>
      <form className={styles.field} role="search" onSubmit={(e) => { e.preventDefault(); setFound({ q, list: find(q) }); }}>
        <label className="label" htmlFor="goto-find">Find in this book</label>
        <div className={styles.inline}>
          <input id="goto-find" type="search" className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="a word, in Greek letters"
            autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn ghost">Find</button>
        </div>
        {found && (
          <div className={styles.found} aria-live="polite">
            <p className={styles.foundCount}>{count(found)}</p>
            {found.list.length > 0 && (
              <ol className={styles.pages}>
                {found.list.map((f) => (
                  <li key={f.unit}>
                    <button type="button" className={`${styles.pageBtn} ${styles.foundBtn}`} onClick={() => { onFound(f, found.q); onDone(); }}>
                      <span className={styles.foundRef}>{f.ref}</span>
                      <span lang="grc" className={styles.foundText}>{f.before}<mark>{f.match}</mark>{f.after}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </form>
    </>
  );
}

function Menu({ title, onClose, className, children }: { title: string; onClose: (refocus: boolean) => void; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.("[data-menu-opener]")) onClose(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-labelledby={id} tabIndex={-1} className={`${styles.menu} ${className}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } }}>
      <div className={styles.head}>
        <h2 id={id} className={styles.menuTitle}>{title}</h2>
        <button type="button" className={`icon-btn ${styles.close}`} onClick={() => onClose(true)}><Icon name="close" label={`Close ${title}`} /></button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange, unavailable }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; unavailable?: (v: T) => boolean;
}) {
  return (
    <div className={styles.field}>
      <span className="label" id={`${label}-label`}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${label}-label`}>
        {options.map(([v, name]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={unavailable?.(v)} onClick={() => onChange(v)}>{name}</button>
        ))}
      </div>
    </div>
  );
}

const THEMES: [Theme, string][] = [["auto", "Follow device"], ["paper", "Paper"], ["night", "Night"]];
const COLUMNS: [Columns, string][] = [["greek", "Greek"], ["both", "Both"], ["trans", "English"]];

/** The Greek's size as the page shows it now, in rem (for the first step from the device's own size). */
function shownRem(): number {
  const probe = document.querySelector<HTMLElement>("[data-greek-probe]");
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return probe ? parseFloat(getComputedStyle(probe).fontSize) / root : 1.5;
}

export default function ReaderBar({ title, showTitle, onTop, where, at, pages, page, onPage, hasEnglish, notes, onNote, here, onSaveBook, onSavePassage, ask,
  example, goTo, find, onFound, editions, edition, onEdition, englishes, english, onEnglish }: {
  /** the book: its Greek title, author and English title, and the lock of a private text */
  title: React.ReactNode;
  /** to the top of the page */
  onTop: () => void;
  /** false while the title page stands under the bar (the title page is the page's heading then) */
  showTitle: boolean;
  /** the page's name ("Sections 17–22") */
  where: string;
  /** "page 1 of 5" */
  at: string;
  pages: string[]; page: number; onPage: (i: number) => void;
  hasEnglish: boolean;
  /** this book's notes, in the order of the book */
  notes: Note[]; onNote: (n: Note) => void;
  /** the passage at the top of the screen (its unit), asked as the Notes menu opens; saving the book or that passage */
  here: () => string | null; onSaveBook: () => void; onSavePassage: (unit: string) => void;
  /** a menu the keyboard asks for; n changes with every asking */
  ask: { menu: Open; n: number } | null;
  /** Go to: a reference to show as an example, the way to a passage (a message when there is none), the search of the book */
  example: string; goTo: (ref: string) => string | null; find: (q: string) => Found[]; onFound: (f: Found, q: string) => void;
  /** the Greek editions and the translations to choose from (Text shows a choice only where there is one) */
  editions: TextOption[]; edition: string; onEdition: (v: string) => void;
  englishes: TextOption[]; english: string; onEnglish: (v: string) => void;
}) {
  const s = useSettings();
  const [open, setOpen] = useState<Open>("");
  const [hereNow, setHereNow] = useState<string | null>(null);
  const aaBtn = useRef<HTMLButtonElement>(null);
  const pagesBtn = useRef<HTMLButtonElement>(null);
  const notesBtn = useRef<HTMLButtonElement>(null);
  const keysBtn = useRef<HTMLButtonElement>(null);
  // closed with ×, Escape or a choice: the focus goes back to the button that opened it (a click elsewhere keeps its own focus)
  const onClose = useCallback((refocus: boolean) => {
    setOpen((was) => {
      if (refocus) (was === "aa" ? aaBtn : was === "notes" ? notesBtn : was === "keys" ? keysBtn : pagesBtn).current?.focus();
      return "";
    });
  }, []);
  // a menu asked for from the keyboard (opened as the asking is seen, once each)
  const [asked, setAsked] = useState(0);
  if (ask && ask.n !== asked) { setAsked(ask.n); setOpen(ask.menu); }
  const toggle = (m: Open) => setOpen((o) => (o === m ? "" : m));
  const size = typeof s.greekSize === "number" ? `${Math.round(s.greekSize * 16)} px` : "the device's size";
  const leading = String(typeof s.leading === "number" ? s.leading : LEADINGS.auto);

  return (
    <header className={styles.bar} data-reader-bar="">
      <div className={styles.in}>
        <Link href="/" className={`${styles.quiet} ${styles.back}`}><Icon name="back" />Library</Link>
        {showTitle ? <h1 className={styles.title}><button type="button" className={styles.top} onClick={onTop} title="To the top of the page">{title}</button></h1> : <span />}

        <nav className={styles.end} aria-label="The reader">
          {/* where you are: the page's name, a thin rule with a short red mark at the place in the book, "page 1 of 5" */}
          <div className={styles.slot}>
            <button ref={pagesBtn} type="button" data-menu-opener="" className={`${styles.quiet} ${styles.where}`} aria-expanded={open === "pages"} aria-haspopup="dialog"
              onClick={() => toggle("pages")}>
              <Icon name="goto" />
              <span className="visually-hidden">Go to: </span><span className={styles.part}>{where}</span><span className="visually-hidden">, </span>
              <span className={styles.rule} aria-hidden="true"><span className={styles.mark} style={{ "--p": pages.length > 1 ? page / (pages.length - 1) : 0 } as React.CSSProperties} /></span>
              <span className={styles.at}>{at}</span>
            </button>
            {open === "pages" && (
              <Menu title="Go to" onClose={onClose} className={styles.pagesMenu}>
                <GoTo example={example} goTo={goTo} find={find} onFound={onFound} onDone={() => onClose(false)} />
                <span className="label" id="pages-label">Pages</span>
                <ol className={styles.pages} aria-labelledby="pages-label">
                  {pages.map((name, i) => (
                    <li key={i}>
                      <button type="button" className={styles.pageBtn} aria-current={i === page ? "page" : undefined}
                        onClick={() => { onPage(i); onClose(false); }}>{name}</button>
                    </li>
                  ))}
                </ol>
              </Menu>
            )}
          </div>

          <div className={styles.slot}>
            <button ref={notesBtn} type="button" data-menu-opener="" className={styles.quiet} aria-expanded={open === "notes"} aria-haspopup="dialog"
              onClick={() => { if (open !== "notes") setHereNow(here()); toggle("notes"); }}>
              <Icon name="note" />Notes{notes.length > 0 && <span className={styles.count}>{notes.length}</span>}
            </button>
            {open === "notes" && (
              <Menu title="Notes in this book" onClose={onClose} className={styles.notesMenu}>
                <NotesMenu notes={notes} here={hereNow} onOpen={(n) => { onClose(false); onNote(n); }}
                  onSaveBook={() => { onClose(false); onSaveBook(); }} onSavePassage={(u) => { onClose(false); onSavePassage(u); }} />
              </Menu>
            )}
          </div>

          <div className={styles.slot}>
            <button ref={aaBtn} type="button" data-menu-opener="" className={styles.quiet} aria-expanded={open === "aa"} aria-haspopup="dialog"
              onClick={() => toggle("aa")}><Icon name="text-size" />Text</button>
            {open === "aa" && (
              <Menu title="Page and text" onClose={onClose} className={styles.aaMenu}>
                <Choice label="Page" value={s.theme} options={THEMES} onChange={(theme) => setSettings({ theme })} />
                <div className={styles.field}>
                  <span className="label" id="size-label">Greek size</span>
                  <div className={styles.sizeRow} role="group" aria-labelledby="size-label">
                    <button type="button" className="btn ghost" disabled={s.greekSize === GREEK_SIZES.min}
                      onClick={() => setSettings({ greekSize: stepSize(s.greekSize, -1, shownRem()) })}>Smaller</button>
                    <button type="button" className="btn ghost" disabled={s.greekSize === GREEK_SIZES.max}
                      onClick={() => setSettings({ greekSize: stepSize(s.greekSize, 1, shownRem()) })}>Larger</button>
                    <span className={styles.sizeNow} aria-live="polite">{size}</span>
                    {s.greekSize !== "auto" && <button type="button" className="text-btn" onClick={() => setSettings({ greekSize: "auto" })}>Device size</button>}
                  </div>
                </div>
                <div className={styles.field}>
                  <span className="label" id="leading-label">Line spacing</span>
                  <div className={styles.sizeRow} role="group" aria-labelledby="leading-label">
                    <button type="button" className="btn ghost" disabled={s.leading === LEADINGS.min}
                      onClick={() => setSettings({ leading: stepLeading(s.leading, -1) })}>Closer</button>
                    <button type="button" className="btn ghost" disabled={s.leading === LEADINGS.max}
                      onClick={() => setSettings({ leading: stepLeading(s.leading, 1) })}>Wider</button>
                    <span className={styles.sizeNow} aria-live="polite">{leading}</span>
                    {s.leading !== "auto" && <button type="button" className="text-btn" onClick={() => setSettings({ leading: "auto" })}>As designed</button>}
                  </div>
                </div>
                <Choice label="Columns" value={s.columns} options={COLUMNS} onChange={(columns) => setSettings({ columns })}
                  unavailable={(c) => c !== "greek" && !hasEnglish} />
                {(editions.length > 1 || englishes.length > 1) && (
                  <div className={styles.field}>
                    <span className="label">Edition</span>
                    <div className={styles.texts}>
                      {editions.length > 1 ? (
                        <label className={styles.pick}>Greek
                          <select value={edition} onChange={(e) => { onEdition(e.target.value); onClose(false); }}>
                            {editions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </label>
                      ) : editions[0] && <span className={styles.pick}>Greek <span className={styles.only}>{editions[0].label}</span></span>}
                      {englishes.length > 1 && (
                        <label className={styles.pick}>English
                          <select value={english} onChange={(e) => { onEnglish(e.target.value); onClose(false); }}>
                            {englishes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </Menu>
            )}
          </div>

          <div className={`${styles.slot} ${styles.keysSlot}`}>
            <button ref={keysBtn} type="button" data-menu-opener="" className={styles.quiet} aria-expanded={open === "keys"} aria-haspopup="dialog"
              onClick={() => toggle("keys")}><Icon name="keys" label="Keys" /></button>
            {open === "keys" && (
              <Menu title="Keys" onClose={onClose} className={styles.keysMenu}>
                <dl className={styles.keys}>
                  {KEYS.map(([keys, what]) => (
                    <div key={what} className={styles.keyRow}>
                      <dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
                      <dd>{what}</dd>
                    </div>
                  ))}
                </dl>
              </Menu>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
