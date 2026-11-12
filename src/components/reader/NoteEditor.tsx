"use client";
/**
 * Writing or editing a note (SPEC.md, "Notes and Saved"), in the look-up's place: a card floating by the note's first word on a
 * tablet or a computer (useFloat.ts), a sheet on a phone (Lookup.module.css). A new note offers what it can stand on (the word, or the words selected; its line of verse
 * if it is in one; its passage); every note has a colour and words. What you write is kept as you write it (half a second after
 * the last key), and when the note is closed by Save, Escape or ×; Remove takes it away.
 */
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { LookupPlace } from "@/lib/lookup/placement";
import { COLOUR_NAMES, COLOURS, KIND_NAMES, newId, placeName, type Anchor, type Colour, type Note } from "@/lib/notes/notes";
import { removeNote, saveNote } from "@/lib/notes/store";
import { firstWord } from "./NoteMarks";
import { useFloat } from "./useFloat";
import look from "./Lookup.module.css";
import styles from "./NoteEditor.module.css";

export type Editing = { note: Note } | { anchors: Anchor[] };

export default function NoteEditor({ editing, work, book, place, onClose }: {
  editing: Editing; work: string; book: string; place: LookupPlace;
  onClose: (refocus: boolean) => void;
}) {
  const old = "note" in editing ? editing.note : null;
  const anchors = old ? [old.anchor] : "anchors" in editing ? editing.anchors : [];
  const [kind, setKind] = useState(0);
  const [colour, setColour] = useState<Colour>(old?.colour ?? "red");
  const text = useRef<HTMLTextAreaElement>(null);
  // floats by the note's first word, which stays put while the note's place is changed between word, line and passage
  const ref = useRef<HTMLElement>(null);
  const [by] = useState(() => (anchors[0] ? firstWord(anchors[0]) : null));
  useFloat(ref, by, place === "float");
  useEffect(() => { text.current?.focus({ preventScroll: true }); }, []);
  // the note's id from the first keystroke, so every keeping is the same note
  const [id] = useState(() => old?.id ?? newId());
  const [kept, setKept] = useState(!!old);
  const last = useRef(old ? JSON.stringify([old.text, old.colour, old.anchor]) : "");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const anchor = anchors[kind];
  /** Keep the note as it stands now, if it has words and they, its colour or its place changed. Whether it has words. */
  const keep = (c: Colour = colour, a: Anchor = anchor): boolean => {
    clearTimeout(timer.current);
    const words = text.current?.value.trim() ?? "";
    if (!words) return false;
    const now = JSON.stringify([words, c, a]);
    if (now !== last.current) { saveNote({ id, work, book, anchor: a, colour: c, text: words }); last.current = now; setKept(true); }
    return true;
  };
  const later = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => keep(), 500); };
  const close = (refocus: boolean) => { keep(); onClose(refocus); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keep()) { text.current?.focus(); return; }
    onClose(true);
  };

  return (
    <aside ref={ref} data-lookup={place} aria-label={old ? `Your note on ${placeName(anchor)}` : "A new note"}
      className={`${look.lookup} ${place === "sheet" ? look.sheet : look.float} ${styles.editor}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(true); } }}>
      <form className={styles.form} onSubmit={save}>
        <div className={`${look.head} ${styles.head}`}>
          <h2 className={styles.title}>{old ? "Your note" : "A new note"}<span className={styles.where}> on {placeName(anchor)}</span></h2>
          <button type="button" className={`icon-btn ${look.x}`} onClick={() => close(true)}><Icon name="close" label="Close the note" /></button>
        </div>
        <div className={styles.body}>
          {anchors.length > 1 && (
            <div className={styles.field}>
              <span className="label" id="note-on">On</span>
              <div className="segmented" role="radiogroup" aria-labelledby="note-on">
                {anchors.map((a, i) => <button key={a.kind} type="button" role="radio" aria-checked={i === kind} onClick={() => { setKind(i); if (kept) keep(colour, a); }}>{KIND_NAMES[a.kind]}</button>)}
              </div>
            </div>
          )}
          <div className={styles.field}>
            <span className="label" id="note-colour">Colour</span>
            <div className={styles.colours} role="radiogroup" aria-labelledby="note-colour">
              {COLOURS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === colour} className={styles.colour} onClick={() => { setColour(c); if (kept) keep(c); }}>
                  <span className={styles.swatch} data-colour={c} aria-hidden="true" />{COLOUR_NAMES[c]}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            <span className="label">Your note</span>
            <textarea ref={text} name="note" className={styles.text} rows={5} maxLength={10_000} defaultValue={old?.text ?? ""} required
              onChange={later} aria-describedby="note-kept" />
          </label>
          <p id="note-kept" className={styles.kept}>{kept ? "Kept as you write." : "Kept as you write, once it has words."}</p>
        </div>
        <div className={styles.row}>
          <button type="submit" className="btn">Save the note</button>
          {kept && <button type="button" className="btn ghost" onClick={() => { clearTimeout(timer.current); removeNote(id); onClose(true); }}>Remove</button>}
        </div>
      </form>
    </aside>
  );
}
