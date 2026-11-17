"use client";
/**
 * What the start page (Home.tsx) and the library (Library.tsx) share: the catalogue and the facts about every work, loaded once
 * (each loader keeps its answer), this device's storage read as the page runs, and a work's row.
 */
import Link from "next/link";
import { memo, useEffect, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import { loadAuthorNames, type AuthorNames } from "@/lib/authors";
import { greekEditions, hasTranslation, loadCatalog, type CatalogIndex, type CatAuthor, type CatWork } from "@/lib/catalog";
import { centuries, commonShare, length, loadDifficulty, vocabOf, type WorkFacts } from "@/lib/library/facts";
import { loadAuthorsMeta, loadWorksMeta, workKinds, type AuthorMeta } from "@/lib/library/kinds";
import { drawableGreek } from "@/lib/greek";
import { splitMatches } from "@/lib/text-match";
import styles from "./Library.module.css";

export const n = (x: number) => x.toLocaleString("en-GB");

export interface Loaded {
  idx: CatalogIndex; names: Record<string, AuthorNames>; who: Record<string, AuthorMeta>; kinds: Map<string, string>;
  meta: Record<string, WorkFacts>; diff: Record<string, [number, number]>;
}

/** The catalogue, the authors' names and every work's facts, or why they could not be loaded. */
export function useCatalogue(): { data?: Loaded; error?: string } {
  const [got, setGot] = useState<{ data?: Loaded; error?: string }>({});
  useEffect(() => {
    let live = true;
    Promise.all([loadCatalog(), loadAuthorNames(), loadWorksMeta(), loadAuthorsMeta(), loadDifficulty()])
      .then(([idx, names, meta, who, diff]) => { if (live) setGot({ data: { idx, names, who, meta, diff, kinds: workKinds(idx.catalog.authors, meta, who) } }); })
      .catch((e: Error) => { if (live) setGot({ error: e.message }); });
    return () => { live = false; };
  }, []);
  return got;
}

const GREEK = /[Ͱ-Ͽἀ-῿]/;

/** This device's storage, read as the page runs (nothing on the server: the list is drawn without it, then with it). */
const noSubscribe = () => () => {};
export function useStored(key: string): string {
  return useSyncExternalStore(noSubscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
}

/** The text with what the search matches marked, accents and capitals aside. */
export function Marked({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  return <>{splitMatches(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

/** How familiar a work's words are: three marks, as many filled as the band, and the share. */
function Vocab({ pct }: { pct: number }) {
  const band = vocabOf(pct);
  const on = band === "familiar" ? 3 : band === "mixed" ? 2 : 1;
  return (
    <span className={styles.vocab} title={`${pct}% of its running words are among the 516 commonest words in Greek`}>
      <span className={styles.bars} aria-hidden="true">{[1, 2, 3].map((k) => <span key={k} data-on={k <= on || undefined} />)}</span>
      {pct}% common words
    </span>
  );
}

/** A work: its title and Greek title (the search's letters marked), then what it is, when, how long, and its words. */
// (memo: a choice re-draws the page at once with the old list, and only the deferred pass should touch the rows)
export const WorkLine = memo(function WorkLine({ w, d, q, by }: { w: CatWork; d: Loaded; q: string; by?: CatAuthor }) {
  const grc = greekEditions(w)[0]?.label;
  const greek = grc && GREEK.test(grc) && grc !== w.title ? drawableGreek(grc) : null;
  const m = d.meta[w.id];
  const pct = commonShare(d.diff[w.id]);
  const facts = [d.kinds.get(w.id), centuries(m?.from, m?.to), length(m?.tokens)].filter(Boolean).join(" · ");
  return (
    <Link className={styles.work} href={`/read?w=${w.id}`} prefetch={false}>
      <span className={styles.workName}>
        <span className={styles.workTitle}><Marked text={w.title} q={q} /></span>
        {greek && <span lang="grc" className={styles.workGr}><Marked text={greek} q={q} /></span>}
        {by && <span className={styles.by}><Marked text={by.name} q={q} /></span>}
      </span>
      <span className={styles.facts}>
        {facts && <span>{facts}</span>}
        {pct !== null && <Vocab pct={pct} />}
        <span className={hasTranslation(w) ? styles.english : styles.greekOnly}>{hasTranslation(w) ? "With English" : "Greek only"}</span>
      </span>
      <Icon name="next" className={styles.go} />
    </Link>
  );
});
