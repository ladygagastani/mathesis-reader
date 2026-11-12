"use client";
/**
 * The notes on this page, shown twice (SPEC.md, "Notes and Saved"). In the text: a noted word is underlined in the note's colour,
 * a noted line or passage has a bar of it at its left. At the right edge of the window: a mark for each note, at the height the
 * scrollbar's thumb has when the note is in view (the note's place in the page, as a share of the page's height). A mark jumps to
 * its note and opens it. Marks that would touch are one mark, which opens the first of them and names how many it holds.
 */
import { useLayoutEffect, useState } from "react";
import { placeName, type Anchor, type Note } from "@/lib/notes/notes";
import styles from "./Reader.module.css";

const TAP = 44;

/** The element a note stands on, on this page; null when it is on another page. */
export function locate(a: Anchor): HTMLElement | null {
  const unit = document.querySelector<HTMLElement>(`main [data-u="${CSS.escape(a.unit)}"]`);
  if (!unit) return null;
  if (a.kind === "passage") return unit.closest("section");
  if (a.kind === "line") return unit.querySelectorAll<HTMLElement>(`.${styles.line}`)[a.line] ?? null;
  return unit.querySelectorAll<HTMLElement>(`.${styles.w}`)[a.i] ?? null;
}

interface Mark { top: number; notes: Note[] }

export default function NoteMarks({ notes, layout, onOpen }: {
  /** this book's notes, not removed */
  notes: Note[];
  /** anything that moves the text (the page, the columns, an English opened, the size): the marks are placed again when it changes */
  layout: unknown;
  onOpen: (n: Note, el: HTMLElement) => void;
}) {
  const [marks, setMarks] = useState<Mark[]>([]);

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const placed = notes.map((n) => ({ n, el: locate(n.anchor) })).filter((x): x is { n: Note; el: HTMLElement } => !!x.el);
    for (const el of main.querySelectorAll("[data-noted]")) { el.removeAttribute("data-noted"); el.removeAttribute("data-colour"); }
    for (const { n, el } of placed) { el.setAttribute("data-noted", n.anchor.kind); el.setAttribute("data-colour", n.colour); }

    const measure = () => {
      const page = document.documentElement.scrollHeight;
      const lowest = innerHeight - TAP;
      const at = placed
        .map(({ n, el }) => ({ n, top: Math.min(lowest, Math.max(0, ((el.getBoundingClientRect().top + scrollY) / page) * innerHeight - TAP / 2)) }))
        .sort((a, b) => a.top - b.top);
      const out: Mark[] = [];
      for (const { n, top } of at) {
        const last = out[out.length - 1];
        if (last && top - last.top < TAP) last.notes.push(n); else out.push({ top, notes: [n] });
      }
      setMarks(out);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(main);
    addEventListener("resize", measure);
    return () => { watch.disconnect(); removeEventListener("resize", measure); };
  }, [notes, layout]);

  if (!marks.length) return null;
  return (
    <nav className={styles.marks} aria-label="Notes on this page">
      {marks.map((m) => {
        const first = m.notes[0];
        const label = m.notes.length > 1 ? `${m.notes.length} notes, from ${placeName(first.anchor)}` : `Note on ${placeName(first.anchor)}: ${first.text.slice(0, 60)}`;
        return (
          <button key={first.id} type="button" className={styles.markBtn} style={{ top: m.top }} aria-label={label} title={label}
            onClick={() => { const el = locate(first.anchor); if (el) onOpen(first, el); }}>
            {m.notes.map((n) => <span key={n.id} className={styles.markBar} data-colour={n.colour} />)}
          </button>
        );
      })}
    </nav>
  );
}
