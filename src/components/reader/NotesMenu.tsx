"use client";
/**
 * The bar's Notes menu (SPEC.md, "Notes and Saved"): what this book holds of yours, and the two quickest ways to keep something.
 * "Save this book" keeps the whole book and "Save passage 17a" the passage at the top of the screen; each opens in the note
 * panel at once, saved, to give it a colour or words. Below them, the book's notes and saved places in the order of the book (the
 * book itself first), with a filter when there are both: a click opens one in the panel to edit, Remove takes it away, and Undo
 * puts it back.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { bare, placeName, type Note } from "@/lib/notes/notes";
import { removeNote, restoreNote } from "@/lib/notes/store";
import styles from "./ReaderBar.module.css";

type Show = "all" | "notes" | "saved";
const SHOWS: [Show, string][] = [["all", "All"], ["notes", "Notes"], ["saved", "Saved"]];

export default function NotesMenu({ notes, here, onOpen, onSaveBook, onSavePassage }: {
  /** this book's notes, in the order of the book */
  notes: Note[];
  /** the passage at the top of the screen as the menu opened (its unit), or null */
  here: string | null;
  /** open a note in the panel (the menu closes) */
  onOpen: (n: Note) => void;
  onSaveBook: () => void;
  onSavePassage: (unit: string) => void;
}) {
  const [show, setShow] = useState<Show>("all");
  const [removed, setRemoved] = useState<Note | null>(null);
  const undoBtn = useRef<HTMLButtonElement>(null);
  const book = notes.find((n) => n.anchor.kind === "book") ?? null;
  const hereSaved = !!here && notes.some((n) => n.anchor.kind === "passage" && n.anchor.unit === here);
  const both = notes.some(bare) && notes.some((n) => !bare(n));
  const list = !both || show === "all" ? notes : notes.filter((n) => (show === "saved") === bare(n));
  const remove = (n: Note) => {
    removeNote(n.id);
    setRemoved(n);
    queueMicrotask(() => undoBtn.current?.focus());
  };

  return (
    <>
      <div className={styles.saveRow}>
        {book
          ? <p className={styles.savedBook}><Icon name="keep" />This book is saved.</p>
          : <button type="button" className="btn ghost" onClick={onSaveBook}><Icon name="keep" />Save this book</button>}
        {here && !hereSaved && <button type="button" className="btn ghost" onClick={() => onSavePassage(here)}><Icon name="keep" />Save passage {here}</button>}
      </div>

      {both && (
        <div className="segmented" role="radiogroup" aria-label="Show">
          {SHOWS.map(([s, name]) => <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setShow(s)}>{name}</button>)}
        </div>
      )}

      {notes.length === 0 && (
        <p className={styles.empty}>
          Nothing in this book yet. Save the book or a passage here, or click a passage&apos;s number in the margin. To write on a word,
          click it, then Note; to write on a few words, select them.
        </p>
      )}
      {list.length > 0 && (
        <ol className={styles.pages} aria-label="Your notes and saved places in this book">
          {list.map((n) => (
            <li key={n.id} className={styles.noteItem}>
              <button type="button" className={`${styles.pageBtn} ${styles.noteBtn}`} onClick={() => onOpen(n)}>
                <span className={styles.swatch} data-colour={n.colour} aria-hidden="true" />
                <span className={styles.noteText}>
                  <span className={styles.notePlace}>{n.anchor.kind === "book" ? "The whole book" : placeName(n.anchor)}</span>
                  {bare(n) ? <span className={styles.noteBare}>Saved, without a note</span> : n.text}
                </span>
              </button>
              <button type="button" className={`text-btn ${styles.noteRemove}`} onClick={() => remove(n)}
                aria-label={`Remove ${bare(n) ? "the saved" : "the note on"} ${placeName(n.anchor)}`}>Remove</button>
            </li>
          ))}
        </ol>
      )}
      {removed && (
        <p className={styles.removed} role="status">
          Removed {bare(removed) ? "the saved" : "the note on"} {placeName(removed.anchor)}.{" "}
          <button ref={undoBtn} type="button" className="text-btn" onClick={() => { restoreNote(removed); setRemoved(null); }}>Undo</button>
        </p>
      )}
      <Link className={styles.allLink} href="/saved">Everything you saved, in every book<Icon name="next" /></Link>
    </>
  );
}
