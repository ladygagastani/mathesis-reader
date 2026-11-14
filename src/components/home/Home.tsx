"use client";
/**
 * The start page, at / (the owner, 2026-11-14: "Move continue reading and where to begin to the top of the page", with the
 * library on a page of its own). The logo, here alone (Mark.tsx), then the books you are reading (lib/reader/place.ts), the books you saved (the
 * reader's Notes) and where to begin: the works with English whose words are the most familiar. Every work is in the library,
 * at /library.
 */
import Link from "next/link";
import { useMemo } from "react";
import Icon from "@/components/Icon";
import Mark from "@/components/Mark";
import { beginnings, shelves } from "@/lib/library/catalogue";
import { shown as notRemoved } from "@/lib/notes/notes";
import { useNotes } from "@/lib/notes/store";
import { PLACES_KEY, type Place } from "@/lib/reader/place";
import { n, useCatalogue, useStored, WorkLine } from "@/components/library/shared";
import lib from "@/components/library/Library.module.css";
import styles from "./Home.module.css";

export default function Home() {
  const got = useCatalogue();
  const d = got.data;
  const all = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, "", "all") : []), [d]);
  const begin = useMemo(() => (d ? beginnings(all, d.diff) : []), [d, all]);
  const total = all.reduce((k, s) => k + s.works.length, 0);

  // the books you are reading, newest first
  const placesRaw = useStored(PLACES_KEY);
  const reading = useMemo(() => {
    try {
      const all = JSON.parse(placesRaw || "{}") as Record<string, Place>;
      return Object.entries(all).filter(([, p]) => p && typeof p.at === "string" && typeof p.t === "number").sort((a, b) => b[1].t - a[1].t).slice(0, 4);
    } catch { return []; }
  }, [placesRaw]);
  // the books saved from the reader's Notes (lib/notes), A to Z
  const allNotes = useNotes();
  const saved = useMemo(() => notRemoved(allNotes).filter((x) => x.anchor.kind === "book").sort((a, b) => a.book.localeCompare(b.book)), [allNotes]);

  return (
    <main id="main" className={`wrap ${styles.home}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}><Mark /></h1>
        <p className={styles.purpose}>Read real Ancient Greek from the first week, with every word explained on the line.</p>
      </header>

      {reading.length > 0 && (
        <section className={lib.reading} aria-labelledby="reading-h">
          <h2 id="reading-h" className="label">Continue reading</h2>
          <ul>
            {reading.map(([w, p]) => (
              <li key={w}>
                <Link href={`/read?w=${encodeURIComponent(w)}`} className={lib.readingLink}>
                  <span className={lib.readingBook}>{p.book}</span>
                  <span className={lib.readingAt}>{p.where} · at {p.at}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length > 0 && (
        <section className={lib.reading} aria-labelledby="saved-h">
          <h2 id="saved-h" className="label">Saved books</h2>
          <ul>
            {saved.map((x) => (
              <li key={x.id}>
                <Link href={`/read?w=${encodeURIComponent(x.work)}`} className={lib.readingLink} style={{ "--accent": `var(--note-${x.colour})` } as React.CSSProperties}>
                  <span className={lib.readingBook}>{x.book}</span>
                  {x.text && <span className={lib.readingAt}>{x.text.length > 80 ? `${x.text.slice(0, 79)}…` : x.text}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="begin" className={styles.begin} aria-labelledby="begin-h">
        <div className={styles.beginHead}>
          <h2 id="begin-h" className={styles.beginName}>Where to begin</h2>
          <p className={styles.beginWhy}>Works with English whose words are the most familiar</p>
        </div>
        {got.error && <p className="muted">The catalogue could not be loaded ({got.error}). <button type="button" className="text-btn" onClick={() => location.reload()}>Try again</button></p>}
        {!d && !got.error && <p className="muted" aria-busy="true">Opening the catalogue…</p>}
        {d && (
          <>
            <ul className={lib.titles}>{begin.map((b) => <li key={b.work.id}><WorkLine w={b.work} d={d} q="" by={b.author} /></li>)}</ul>
            <p className={`${lib.note} ${styles.measure}`}>The share of a text&apos;s running words that are among the 516 commonest words in Greek (the Dickinson College Commentaries core list, counted over the GLAUx analysis). It measures the words only, not the grammar or the ideas.</p>
          </>
        )}
      </section>

      <p className={styles.all}>
        <Link className="btn ghost" href="/library"><Icon name="library" />{d ? `Every work in the library, ${n(total)} of them` : "Every work in the library"}<Icon name="next" /></Link>
      </p>
    </main>
  );
}
