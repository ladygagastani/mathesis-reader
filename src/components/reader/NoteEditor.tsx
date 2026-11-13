"use client";
/**
 * Writing or editing a note (SPEC.md, "Notes and Saved"), in the look-up's place: the panel that slides in from the
 * right, or the sheet (Lookup.module.css). A new note offers what it can stand on (the word, or the words selected; its line of verse
 * if it is in one; its passage; or the whole book). Every note has a colour. A note on a single word needs words; a book, a passage,
 * a line or words selected can be saved without any, as a favourite. What you write is kept as you write it (half a second after
 * the last key), and when the note is closed by Save, Escape or ×; Remove takes it away.
 */
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { LookupPlace } from "@/lib/lookup/placement";
import { COLOUR_NAMES, COLOURS, KIND_NAMES, mayBeBare, newId, placeName, type Anchor, type Colour, type Note } from "@/lib/notes/notes";
import { removeNote, saveNote } from "@/lib/notes/store";
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
  useEffect(() => { text.current?.focus({ preventScroll: true }); }, []);
  // the note's id from the first keystroke, so every keeping is the same note
  const [id] = useState(() => old?.id ?? newId());
  const [kept, setKept] = useState(!!old);
  const [hasWords, setHasWords] = useState(!!old?.text);
  const last = useRef(old ? JSON.stringify([old.text, old.colour, old.anchor]) : "");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const anchor = anchors[kind];
  /**
   * Keep the note as it stands now, if its words, its colour or its place changed. A note with no words is kept only where it may
   * be (not on a single word), and only once it has been saved (by Save, `asked`, or before). Whether the note is kept.
   */
  const keep = (c: Colour = colour, a: Anchor = anchor, asked = false): boolean => {
    clearTimeout(timer.current);
    const words = text.current?.value.trim() ?? "";
    if (!words && !(mayBeBare(a) && (asked || kept))) return false;
    const now = JSON.stringify([words, c, a]);
    if (now !== last.current) { saveNote({ id, work, book, anchor: a, colour: c, text: words }); last.current = now; setKept(true); }
    return true;
  };
  const later = () => { setHasWords(!!text.current?.value.trim()); clearTimeout(timer.current); timer.current = window.setTimeout(() => keep(), 500); };
  const close = (refocus: boolean) => { keep(); onClose(refocus); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keep(colour, anchor, true)) { text.current?.focus(); return; }
    onClose(true);
  };

  const bareOk = mayBeBare(anchor);
  const what = KIND_NAMES[anchor.kind].toLowerCase();
  const title = !old ? "A new note" : hasWords ? "Your note" : "Saved";
  const hint = kept ? "Kept as you write." : bareOk ? `Words are optional: Save keeps ${what} without them.` : "Kept as you write, once it has words.";

  return (
    <aside data-lookup={place} aria-label={old ? `Your note on ${placeName(anchor)}` : "A new note"}
      className={`${look.lookup} ${place === "sheet" ? look.sheet : look.drawer} ${styles.editor}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(true); } }}>
      <form className={styles.form} onSubmit={save}>
        <div className={`${look.head} ${styles.head}`}>
          <h2 className={styles.title}>{title}<span className={styles.where}>{title === "Saved" ? ": " : " on "}{placeName(anchor)}</span></h2>
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
            <textarea ref={text} name="note" className={styles.text} rows={5} maxLength={10_000} defaultValue={old?.text ?? ""} required={!bareOk}
              onChange={later} aria-describedby="note-kept" />
          </label>
          <p id="note-kept" className={styles.kept}>{hint}</p>
        </div>
        <div className={styles.row}>
          <button type="submit" className="btn">{hasWords || !bareOk ? "Save the note" : kept ? "Done" : `Save ${what} without a note`}</button>
          {kept && <button type="button" className="btn ghost" onClick={() => { clearTimeout(timer.current); removeNote(id); onClose(true); }}>Remove</button>}
        </div>
      </form>
    </aside>
  );
}
