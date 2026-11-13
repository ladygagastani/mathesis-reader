"use client";
/**
 * Saved (SPEC.md, "Notes and Saved"; DESIGN.md, "Saved"): every note on this device, book by book (a saved book first, then the
 * newest first), and the words saved from the look-up, as a Greek dictionary orders them. The left column picks what the right one
 * shows: every book's notes, one book's, the saved books, or the words. A note or a saved place opens at its place in the book, and
 * can be edited (a saved place given words, or its words taken away) or removed here; a word opens at the passage it was met in,
 * or is taken off. Says whether they go with a sync code or stay on this device only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { bare, byNewest, mayBeBare, placeName, shown, type Note } from "@/lib/notes/notes";
import { removeNote, removeWord, saveNote, useNotes, useNotesSync, useWords } from "@/lib/notes/store";
import { byLemma, type SavedWord } from "@/lib/notes/words";
import { useSyncCode } from "@/lib/sync";
import styles from "./Saved.module.css";

const href = (n: Note) => `/read?w=${encodeURIComponent(n.work)}${n.anchor.unit ? `&at=${encodeURIComponent(n.anchor.unit)}` : ""}&note=${n.id}`;
const where = (n: Note) => (n.anchor.kind === "book" ? "The whole book" : placeName(n.anchor));
/** A book's notes: the whole book's first, then the newest first. */
const inBook = (a: Note, b: Note) => Number(b.anchor.kind === "book") - Number(a.anchor.kind === "book") || byNewest(a, b);

function Item({ n, withBook = false }: { n: Note; withBook?: boolean }) {
  const [editing, setEditing] = useState(false);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("note")).trim();
    if (text || mayBeBare(n.anchor)) saveNote({ ...n, text });
    setEditing(false);
  };
  return (
    <li className={styles.item}>
      <p className={styles.place}><span className={styles.swatch} data-colour={n.colour} aria-hidden="true" />{withBook ? n.book : where(n)}</p>
      {editing ? (
        <form className={styles.edit} onSubmit={save}>
          <label className="visually-hidden" htmlFor={`edit-${n.id}`}>Your note on {placeName(n.anchor)}</label>
          <textarea id={`edit-${n.id}`} name="note" className={styles.text} rows={4} maxLength={10_000} defaultValue={n.text} autoFocus required={!mayBeBare(n.anchor)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
          <div className={styles.actions}>
            <button type="submit" className="btn">Save the note</button>
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {bare(n) ? <p className={styles.bare}>Saved, without a note.</p> : <p className={styles.words}>{n.text}</p>}
          <div className={styles.actions}>
            <Link className="text-btn" href={href(n)}>Open in the book<Icon name="next" /></Link>
            <button type="button" className="text-btn" onClick={() => setEditing(true)}>{bare(n) ? "Add a note" : "Edit"}</button>
            <button type="button" className="text-btn" onClick={() => removeNote(n.id)}>Remove</button>
          </div>
        </>
      )}
    </li>
  );
}

function WordItem({ w }: { w: SavedWord }) {
  return (
    <li className={styles.word}>
      <span lang="grc" className={styles.lemma}>{w.lemma}</span>
      <span className={styles.wordAbout}>
        {w.kind && <span className={styles.kind}>{w.kind}</span>}
        <span className={styles.meaning}>{w.meaning || "No meaning was given for it."}</span>
        <span className={styles.met}>
          Met as <span lang="grc">{w.form}</span> in {w.book}, {w.unit}
        </span>
      </span>
      <span className={styles.actions}>
        <Link className="text-btn" href={`/read?w=${encodeURIComponent(w.work)}&at=${encodeURIComponent(w.unit)}`}>Open where you met it<Icon name="next" /></Link>
        <button type="button" className="text-btn" onClick={() => removeWord(w.id)}>Remove</button>
      </span>
    </li>
  );
}

export default function Saved() {
  const all = useNotes();
  const code = useSyncCode();
  const sync = useNotesSync();
  const allWords = useWords();
  const words = useMemo(() => allWords.filter((w) => !w.deleted).sort(byLemma), [allWords]);
  const books = useMemo(() => {
    const by = new Map<string, Note[]>();
    for (const n of shown(all).sort(inBook)) by.set(n.work, [...(by.get(n.work) ?? []), n]);
    return [...by.values()];
  }, [all]);
  const savedBooks = useMemo(() => shown(all).filter((n) => n.anchor.kind === "book").sort((a, b) => a.book.localeCompare(b.book)), [all]);
  // what the right shows: every book's notes (""), one book's (its work id), the saved books ("#books"), or the words ("#words")
  const [only, setOnly] = useState("");
  const wordsShown = only === "#words" ? words.length > 0 : !books.length && words.length > 0;
  const booksShown = !wordsShown && only === "#books" && savedBooks.length > 0;
  const showing = only && books.some((b) => b[0].work === only) ? books.filter((b) => b[0].work === only) : books;
  const total = books.reduce((k, b) => k + b.length, 0);

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>Saved</h1>
        <p className={styles.purpose}>Your notes, in every book, and the words you saved. Each opens at its place in the text.</p>
        <p className={styles.status}>
          {code === null && <>These notes are on this device only. <Link href="/sync">Sync it</Link> to keep them with a code, on every device.</>}
          {code && sync.state === "failed" && <>Not synced just now: {sync.error}</>}
          {code && sync.state === "syncing" && <>Syncing…</>}
          {code && sync.state === "done" && <>Synced. These notes go with your code.</>}
        </p>
      </header>
      {books.length === 0 && words.length === 0 && <p className={styles.none}>Nothing saved yet. In a book, open Notes to save the book or a passage, or click a passage&apos;s number; click a word, then Note or Save word; or select a few words.</p>}
      {(books.length > 0 || words.length > 0) && (
        <div className={styles.cols}>
          <nav className={styles.books} aria-label="Books and words">
            {books.length > 0 && (
              <>
                <span className="label">Notes</span>
                <ul>
                  <li><button type="button" aria-pressed={!wordsShown && !booksShown && (!only || only === "#books" || !showing.length)} onClick={() => setOnly("")}>Every book<span className={styles.n}>{total}</span></button></li>
                  {savedBooks.length > 0 && <li><button type="button" aria-pressed={booksShown} onClick={() => setOnly("#books")}>Saved books<span className={styles.n}>{savedBooks.length}</span></button></li>}
                  {books.map((b) => (
                    <li key={b[0].work}><button type="button" aria-pressed={!wordsShown && only === b[0].work} onClick={() => setOnly(b[0].work)}>{b[0].book}<span className={styles.n}>{b.length}</span></button></li>
                  ))}
                </ul>
              </>
            )}
            <span className={`label ${styles.groupGap}`}>Words</span>
            <ul>
              <li><button type="button" aria-pressed={wordsShown} disabled={!words.length} onClick={() => setOnly("#words")}>Saved words<span className={styles.n}>{words.length}</span></button></li>
            </ul>
          </nav>
          <div className={styles.notes}>
            {wordsShown && (
              <section className={styles.book} aria-labelledby="saved-words">
                <h2 id="saved-words" className={styles.bookName}>Saved words</h2>
                <ul className={styles.list}>{words.map((w) => <WordItem key={w.id} w={w} />)}</ul>
              </section>
            )}
            {booksShown && (
              <section className={styles.book} aria-labelledby="saved-books">
                <h2 id="saved-books" className={styles.bookName}>Saved books</h2>
                <ul className={styles.list}>{savedBooks.map((n) => <Item key={n.id} n={n} withBook />)}</ul>
              </section>
            )}
            {!wordsShown && !booksShown && showing.map((notes) => (
              <section key={notes[0].work} className={styles.book} aria-labelledby={`b-${notes[0].id}`}>
                <h2 id={`b-${notes[0].id}`} className={styles.bookName}>{notes[0].book}</h2>
                <ul className={styles.list}>{notes.map((n) => <Item key={n.id} n={n} />)}</ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
