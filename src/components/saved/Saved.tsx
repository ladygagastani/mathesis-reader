"use client";
/**
 * Saved (SPEC.md, "Notes and Saved"; DESIGN.md, "Saved"): every note on this device, book by book, the newest first in each, with
 * the books listed at the left to show one at a time. A note opens at its place in the book, and can be edited or removed here.
 * Says whether the notes go with a sync code or stay on this device only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { byNewest, placeName, shown, type Note } from "@/lib/notes/notes";
import { removeNote, saveNote, useNotes, useNotesSync } from "@/lib/notes/store";
import { useSyncCode } from "@/lib/sync";
import styles from "./Saved.module.css";

const href = (n: Note) => `/read?w=${encodeURIComponent(n.work)}&at=${encodeURIComponent(n.anchor.unit)}&note=${n.id}`;

function Item({ n }: { n: Note }) {
  const [editing, setEditing] = useState(false);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("note")).trim();
    if (text) saveNote({ ...n, text });
    setEditing(false);
  };
  return (
    <li className={styles.item}>
      <p className={styles.place}><span className={styles.swatch} data-colour={n.colour} aria-hidden="true" />{placeName(n.anchor)}</p>
      {editing ? (
        <form className={styles.edit} onSubmit={save}>
          <label className="visually-hidden" htmlFor={`edit-${n.id}`}>Your note on {placeName(n.anchor)}</label>
          <textarea id={`edit-${n.id}`} name="note" className={styles.text} rows={4} maxLength={10_000} defaultValue={n.text} autoFocus required
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
          <div className={styles.actions}>
            <button type="submit" className="btn">Save the note</button>
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className={styles.words}>{n.text}</p>
          <div className={styles.actions}>
            <Link className="text-btn" href={href(n)}>Open in the book<Icon name="next" /></Link>
            <button type="button" className="text-btn" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="text-btn" onClick={() => removeNote(n.id)}>Remove</button>
          </div>
        </>
      )}
    </li>
  );
}

export default function Saved() {
  const all = useNotes();
  const code = useSyncCode();
  const sync = useNotesSync();
  const books = useMemo(() => {
    const by = new Map<string, Note[]>();
    for (const n of shown(all).sort(byNewest)) by.set(n.work, [...(by.get(n.work) ?? []), n]);
    return [...by.values()];
  }, [all]);
  // the one book shown, or every book ("")
  const [only, setOnly] = useState("");
  const showing = only && books.some((b) => b[0].work === only) ? books.filter((b) => b[0].work === only) : books;
  const total = books.reduce((k, b) => k + b.length, 0);

  return (
    <main id="main" className={`wrap ${styles.page}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>Saved</h1>
        <p className={styles.purpose}>Your notes, in every book. Each opens at its place in the text.</p>
        <p className={styles.status}>
          {code === null && <>These notes are on this device only. <Link href="/sync">Sync it</Link> to keep them with a code, on every device.</>}
          {code && sync.state === "failed" && <>Not synced just now: {sync.error}</>}
          {code && sync.state === "syncing" && <>Syncing…</>}
          {code && sync.state === "done" && <>Synced. These notes go with your code.</>}
        </p>
      </header>
      {books.length === 0 && <p className={styles.none}>Nothing saved yet. In a book, click a word, then Note; or select a few words.</p>}
      {books.length > 0 && (
        <div className={styles.cols}>
          <nav className={styles.books} aria-label="Books">
            <span className="label">Books</span>
            <ul>
              <li><button type="button" aria-pressed={!only || !showing.length} onClick={() => setOnly("")}>Every book<span className={styles.n}>{total}</span></button></li>
              {books.map((b) => (
                <li key={b[0].work}><button type="button" aria-pressed={only === b[0].work} onClick={() => setOnly(b[0].work)}>{b[0].book}<span className={styles.n}>{b.length}</span></button></li>
              ))}
            </ul>
          </nav>
          <div className={styles.notes}>
            {showing.map((notes) => (
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
