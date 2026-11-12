"use client";
/**
 * Writing or editing a note (SPEC.md, "Notes and Saved"), in the look-up's place: the desk beside the text on a computer, a
 * sheet on a phone (Lookup.module.css). A new note offers what it can stand on (the word, its line of verse if it is in one, its
 * passage); every note has a colour and words. Save keeps it, Remove takes it away, Escape or × leaves it as it was.
 */
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { LookupPlace } from "@/lib/lookup/placement";
import { COLOUR_NAMES, COLOURS, KIND_NAMES, newId, placeName, type Anchor, type Colour, type Note } from "@/lib/notes/notes";
import { removeNote, saveNote } from "@/lib/notes/store";
import look from "./Lookup.module.css";
import styles from "./NoteEditor.module.css";

export type Editing = { note: Note } | { anchors: Anchor[] };

export default function NoteEditor({ editing, work, book, place, inDesk, over, onClose }: {
  editing: Editing; work: string; book: string; place: LookupPlace;
  /** in the desk beside the text; or, with no desk, over the English column */
  inDesk: boolean; over: { left: number; width: number } | null;
  onClose: (refocus: boolean) => void;
}) {
  const old = "note" in editing ? editing.note : null;
  const anchors = old ? [old.anchor] : "anchors" in editing ? editing.anchors : [];
  const [kind, setKind] = useState(0);
  const [colour, setColour] = useState<Colour>(old?.colour ?? "red");
  const text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { text.current?.focus({ preventScroll: true }); }, []);

  const anchor = anchors[kind];
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const words = text.current?.value.trim() ?? "";
    if (!words) { text.current?.focus(); return; }
    saveNote({ id: old?.id ?? newId(), work, book, anchor, colour, text: words });
    onClose(true);
  };

  return (
    <aside data-lookup={place} aria-label={old ? `Your note on ${placeName(anchor)}` : "A new note"}
      className={`${look.lookup} ${place === "sheet" ? look.sheet : inDesk ? look.desk : look.note} ${styles.editor}`}
      style={place === "note" && !inDesk && over ? { left: over.left, width: over.width } : undefined}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } }}>
      <form className={styles.form} onSubmit={save}>
        <div className={`${look.head} ${styles.head}`}>
          <h2 className={styles.title}>{old ? "Your note" : "A new note"}<span className={styles.where}> on {placeName(anchor)}</span></h2>
          <button type="button" className={`icon-btn ${look.x}`} onClick={() => onClose(true)}><Icon name="close" label="Close the note" /></button>
        </div>
        <div className={styles.body}>
          {anchors.length > 1 && (
            <div className={styles.field}>
              <span className="label" id="note-on">On</span>
              <div className="segmented" role="radiogroup" aria-labelledby="note-on">
                {anchors.map((a, i) => <button key={a.kind} type="button" role="radio" aria-checked={i === kind} onClick={() => setKind(i)}>{KIND_NAMES[a.kind]}</button>)}
              </div>
            </div>
          )}
          <div className={styles.field}>
            <span className="label" id="note-colour">Colour</span>
            <div className={styles.colours} role="radiogroup" aria-labelledby="note-colour">
              {COLOURS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === colour} className={styles.colour} onClick={() => setColour(c)}>
                  <span className={styles.swatch} data-colour={c} aria-hidden="true" />{COLOUR_NAMES[c]}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            <span className="label">Your note</span>
            <textarea ref={text} name="note" className={styles.text} rows={5} maxLength={10_000} defaultValue={old?.text ?? ""} required />
          </label>
        </div>
        <div className={styles.row}>
          <button type="submit" className="btn">Save the note</button>
          {old && <button type="button" className="btn ghost" onClick={() => { removeNote(old.id); onClose(true); }}>Remove</button>}
        </div>
      </form>
    </aside>
  );
}
