"use client";
/**
 * The library (SPEC.md, "The library"; DESIGN.md, "Library"): a short head, the search, then every work. Above the list: the books
 * you are reading (lib/reader/place.ts) and, folded, where to begin. The list opens as one A to Z list of authors (the owner,
 * 2026-11-12), each author a row with their works beside them; it can also list the titles A to Z, or group the authors by kind of
 * writing or by period. With English or Greek only, a period, a dialect and how familiar the words are narrow it. Each work says
 * its Greek title, kind, date, length and vocabulary (lib/library/facts.ts). A rail of letters beside an A to Z list jumps to a
 * letter. The address keeps the search, the order and the filters (/?q=plato&sort=kind&period=…), so Back returns to the same list.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import { FIND_KEY } from "@/components/site/SlashSearch";
import { loadAuthorNames, type AuthorNames } from "@/lib/authors";
import { greekEditions, hasTranslation, loadCatalog, type CatalogIndex, type CatAuthor, type CatWork } from "@/lib/catalog";
import { bcAd } from "@/lib/library/bc-ad";
import { AZ_OTHER } from "@/lib/library/az";
import { beginnings, bestShelf, byKind, byLetter, byPeriod, byTitle, shelves, type Shelf, type Show, type TitlePart } from "@/lib/library/catalogue";
import { centuries, commonShare, dialects, length, loadDifficulty, passes, PERIODS, UNDATED, VOCAB, vocabOf, type Filters, type WorkFacts } from "@/lib/library/facts";
import { loadAuthorsMeta, loadWorksMeta, workKinds, type AuthorMeta } from "@/lib/library/kinds";
import { PLACES_KEY, type Place } from "@/lib/reader/place";
import { splitMatches } from "@/lib/text-match";
import styles from "./Library.module.css";

type Sort = "az" | "titles" | "kind" | "period";
const SHOWS: [Show, string][] = [["all", "All"], ["english", "With English"], ["greek", "Greek only"]];
const SORTS: [Sort, string][] = [["az", "Authors A–Z"], ["titles", "Titles A–Z"], ["kind", "By kind"], ["period", "By period"]];
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", AZ_OTHER];
/** an author shows this many works until "All n works" is pressed */
const FIRST = 6;
const BEGIN_KEY = "mathesis-reader:library-begin";
const n = (x: number) => x.toLocaleString("en-GB");
const GREEK = /[Ͱ-Ͽἀ-῿]/;

interface Loaded {
  idx: CatalogIndex; names: Record<string, AuthorNames>; who: Record<string, AuthorMeta>; kinds: Map<string, string>;
  meta: Record<string, WorkFacts>; diff: Record<string, [number, number]>;
}

/** This device's storage, read as the page runs (nothing on the server: the list is drawn without it, then with it). */
const noSubscribe = () => () => {};
function useStored(key: string): string {
  return useSyncExternalStore(noSubscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
}

/** The text with what the search matches marked, accents and capitals aside. */
function Marked({ text, q }: { text: string; q: string }) {
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
function WorkLine({ w, d, q, by }: { w: CatWork; d: Loaded; q: string; by?: CatAuthor }) {
  const grc = greekEditions(w)[0]?.label;
  const greek = grc && GREEK.test(grc) && grc !== w.title ? grc : null;
  const m = d.meta[w.id];
  const pct = commonShare(d.diff[w.id]);
  const facts = [d.kinds.get(w.id), centuries(m?.from, m?.to), length(m?.tokens)].filter(Boolean).join(" · ");
  return (
    <Link className={styles.work} href={`/read?w=${w.id}`}>
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
}

/** An author: their names and who they were at the left, their works at the right. */
function AuthorRow({ s, d, q }: { s: Shelf; d: Loaded; q: string }) {
  const [all, setAll] = useState(false);
  const grc = d.names[s.author.id]?.grc;
  const desc = d.who[s.author.id]?.desc;
  const shown = all ? s.works : s.works.slice(0, FIRST);
  return (
    <li className={styles.author}>
      <div className={styles.who}>
        <span className={styles.name}><Marked text={s.author.name} q={q} /></span>
        {grc && grc !== s.author.name && <span lang="grc" className={styles.grc}><Marked text={grc} q={q} /></span>}
        {desc && <span className={styles.desc}>{bcAd(desc)}</span>}
      </div>
      <div className={styles.worksBox}>
        <ul className={styles.works}>{shown.map((w) => <li key={w.id}><WorkLine w={w} d={d} q={q} /></li>)}</ul>
        {s.works.length > FIRST && (
          <button type="button" className={`text-btn ${styles.more}`} aria-expanded={all} onClick={() => setAll(!all)}>
            <Icon name={all ? "chevron-up" : "chevron-down"} />{all ? `The first ${FIRST}` : `All ${n(s.works.length)} works`}
          </button>
        )}
      </div>
    </li>
  );
}

/** The rail of letters beside an A to Z list: a letter jumps to its part; the letter you are reading under is marked. */
function Rail({ keys }: { keys: string[] }) {
  const [here, setHere] = useState("");
  useEffect(() => {
    const heads = keys.map((k) => document.getElementById(`part-${k}`)).filter((x): x is HTMLElement => !!x);
    const watch = new IntersectionObserver((seen) => {
      const top = seen.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setHere(top.target.id.slice(5));
    }, { rootMargin: "-56px 0px -70% 0px" });
    heads.forEach((h) => watch.observe(h));
    return () => watch.disconnect();
  }, [keys]);
  return (
    <nav className={styles.rail} aria-label="Letters">
      {LETTERS.map((l) => keys.includes(l)
        ? <a key={l} href={`#part-${l}`} aria-current={l === here ? "true" : undefined}>{l}</a>
        : <span key={l} aria-hidden="true">{l}</span>)}
    </nav>
  );
}

export default function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const show = (SHOWS.find(([s]) => s === params.get("show"))?.[0] ?? "all") as Show;
  const sort = (SORTS.find(([s]) => s === params.get("sort"))?.[0] ?? "az") as Sort;
  const filters: Filters = { period: params.get("period") ?? "", dialect: params.get("dialect") ?? "", vocab: params.get("vocab") ?? "" };
  const filtersOn = !!(filters.period || filters.dialect || filters.vocab);
  const [got, setGot] = useState<{ data?: Loaded; error?: string }>({});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadCatalog(), loadAuthorNames(), loadWorksMeta(), loadAuthorsMeta(), loadDifficulty()])
      .then(([idx, names, meta, who, diff]) => { if (live) setGot({ data: { idx, names, who, meta, diff, kinds: workKinds(idx.catalog.authors, meta, who) } }); })
      .catch((e: Error) => { if (live) setGot({ error: e.message }); });
    return () => { live = false; };
  }, []);

  // "/" on another page brought you here to search
  useEffect(() => {
    try { if (sessionStorage.getItem(FIND_KEY)) { sessionStorage.removeItem(FIND_KEY); field.current?.focus(); } } catch { /* storage blocked */ }
  }, []);

  /** the address follows the search, the order and the filters, replaced rather than added to, so Back leaves the library */
  const setParam = (patch: Record<string, string>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v && v !== "all" && v !== "az") q.set(k, v); else q.delete(k); }
    router.replace(q.size ? `/?${q}` : "/", { scroll: false });
  };
  useEffect(() => {
    const t = setTimeout(() => { if ((params.get("q") ?? "") !== query.trim()) setParam({ q: query.trim() }); }, 300);
    return () => clearTimeout(t);
  });
  const clearAll = () => { setQuery(""); router.replace(sort === "az" ? "/" : `/?sort=${sort}`, { scroll: false }); };

  const d = got.data;
  const keep = useMemo(() => (d && filtersOn ? (w: CatWork) => passes(w.id, filters, d.meta, d.diff) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, filters.period, filters.dialect, filters.vocab]);
  const list = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, query, show, keep) : []), [d, query, show, keep]);
  const all = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, "", "all") : []), [d]);
  const parts = useMemo(() => (!d ? [] : sort === "az" ? byLetter(list) : sort === "kind" ? byKind(list, d.kinds) : sort === "period" ? byPeriod(list, d.meta) : []), [d, list, sort]);
  const titleParts: TitlePart[] = useMemo(() => (d && sort === "titles" ? byTitle(list) : []), [d, list, sort]);
  const best = d && sort !== "titles" ? bestShelf(list, d.names, query) : null;
  const total = all.reduce((k, s) => k + s.works.length, 0);
  const english = all.reduce((k, s) => k + s.works.filter(hasTranslation).length, 0);
  const shown = list.reduce((k, s) => k + s.works.length, 0);
  const begin = useMemo(() => (d ? beginnings(all, d.diff) : []), [d, all]);
  const dialectList = useMemo(() => (d ? dialects(d.meta) : []), [d]);

  // the books you are reading, newest first
  const placesRaw = useStored(PLACES_KEY);
  const reading = useMemo(() => {
    try {
      const all = JSON.parse(placesRaw || "{}") as Record<string, Place>;
      return Object.entries(all).filter(([, p]) => p && typeof p.at === "string" && typeof p.t === "number").sort((a, b) => b[1].t - a[1].t).slice(0, 4);
    } catch { return []; }
  }, [placesRaw]);
  const beginOpen = useStored(BEGIN_KEY) === "open";
  const railKeys = sort === "az" ? parts.map((p) => p.key) : sort === "titles" ? titleParts.map((p) => p.key) : [];
  const q = query.trim();

  return (
    <main id="main" className={`wrap ${styles.library}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>The library <span lang="grc" className={styles.titleGr}>Μουσεῖον</span></h1>
        <p className={styles.purpose}>
          {d ? `${n(total)} Greek works by ${n(all.length)} authors, ${n(english)} of them with an English translation. ` : ""}
          Open one and read it in Greek, with every word explained on the line.
        </p>
      </header>

      <search className={styles.find}>
        <label className={styles.field}>
          <span className="label">Search the library</span>
          <span className={styles.fieldRow}>
            <Icon name="search" className={styles.fieldSign} />
            <input ref={field} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="an author or a title, in English or Greek"
              autoComplete="off" spellCheck={false} aria-describedby="find-key" />
            <kbd id="find-key" className={styles.key} title="Press / on any page to search the library">/</kbd>
          </span>
        </label>
      </search>

      <div className={styles.controls}>
        <div className={styles.control}>
          <span className="label" id="show-label">Show</span>
          <div className="segmented" role="radiogroup" aria-labelledby="show-label">
            {SHOWS.map(([s, label]) => <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setParam({ show: s })}>{label}</button>)}
          </div>
        </div>
        <div className={styles.control}>
          <span className="label" id="order-label">Order</span>
          <div className="segmented" role="radiogroup" aria-labelledby="order-label">
            {SORTS.map(([s, label]) => <button key={s} type="button" role="radio" aria-checked={sort === s} onClick={() => setParam({ sort: s })}>{label}</button>)}
          </div>
        </div>
        <div className={styles.control}>
          <span className="label" id="filter-label">Filter</span>
          <div className={styles.selects} role="group" aria-labelledby="filter-label">
            <select aria-label="Period" value={filters.period} data-set={filters.period || undefined} onChange={(e) => setParam({ period: e.target.value })}>
              <option value="">Any period</option>
              {[...PERIODS.map(([p]) => p), UNDATED].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select aria-label="Dialect" value={filters.dialect} data-set={filters.dialect || undefined} onChange={(e) => setParam({ dialect: e.target.value })}>
              <option value="">Any dialect</option>
              {dialectList.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select aria-label="Vocabulary" value={filters.vocab} data-set={filters.vocab || undefined} onChange={(e) => setParam({ vocab: e.target.value })}>
              <option value="">Any vocabulary</option>
              {VOCAB.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {filtersOn && <button type="button" className="text-btn" onClick={() => setParam({ period: "", dialect: "", vocab: "" })}>Clear the filters</button>}
          </div>
        </div>
      </div>

      {reading.length > 0 && !q && (
        <section className={styles.reading} aria-labelledby="reading-h">
          <h2 id="reading-h" className="label">Continue reading</h2>
          <ul>
            {reading.map(([w, p]) => (
              <li key={w}>
                <Link href={`/read?w=${encodeURIComponent(w)}`} className={styles.readingLink}>
                  <span className={styles.readingBook}>{p.book}</span>
                  <span className={styles.readingAt}>{p.where} · at {p.at}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d && begin.length > 0 && !q && (
        <details className={styles.begin} open={beginOpen} onToggle={(e) => { try { localStorage.setItem(BEGIN_KEY, e.currentTarget.open ? "open" : "shut"); } catch { /* blocked */ } }}>
          <summary><span className={styles.beginName}>Where to begin</span> <span className={styles.beginWhy}>Works with English whose words are the most familiar</span></summary>
          <div className={styles.beginBody}>
            <p className={styles.note}>The share of a text&apos;s running words that are among the 516 commonest words in Greek (the Dickinson College Commentaries core list, counted over the GLAUx analysis). It measures the words only, not the grammar or the ideas.</p>
            <ul className={styles.titles}>{begin.map((b) => <li key={b.work.id}><WorkLine w={b.work} d={d} q="" by={b.author} /></li>)}</ul>
          </div>
        </details>
      )}

      <section className={styles.all} aria-labelledby="every-work">
        <div className={styles.allHead}>
          <h2 id="every-work">Every work in the library</h2>
          {d && <p className={styles.count} aria-live="polite">{shown === total ? `${n(total)} works` : `${n(shown)} of ${n(total)} works`}</p>}
        </div>

        {got.error && <p className={styles.status}>The catalogue could not be loaded ({got.error}). <button type="button" className="text-btn" onClick={() => location.reload()}>Try again</button></p>}
        {!d && !got.error && <p className={`muted ${styles.status}`} aria-busy="true">Opening the catalogue…</p>}
        {d && !list.length && (
          <div className={styles.status}>
            <p>No work in the library matches {q ? `"${q}"` : "these filters"}{show !== "all" ? ` with this choice (${SHOWS.find(([s]) => s === show)![1]})` : ""}.</p>
            <p className="muted">Try fewer letters, or the name in English. <button type="button" className="text-btn" onClick={clearAll}>Clear the search and the filters</button></p>
          </div>
        )}

        <div className={railKeys.length ? styles.withRail : undefined}>
          {railKeys.length > 0 && <Rail keys={railKeys} />}
          <div className={styles.listCol}>
            {d && best && (
              <section className={styles.part} aria-label="Best match">
                <div className={styles.partHead}><h3 className={styles.partName}>Best match</h3></div>
                <ul className={styles.authors}><AuthorRow s={best} d={d} q={q} /></ul>
              </section>
            )}
            {d && parts.map((p) => (
              <section key={p.key} className={styles.part} aria-labelledby={`part-${p.key}`}>
                <div className={styles.partHead}>
                  <h3 id={`part-${p.key}`} className={styles.partName}>{p.label}</h3>
                  <span className={styles.partCount}>{n(p.works)} {p.works === 1 ? "work" : "works"} · {n(p.shelves.length)} {p.shelves.length === 1 ? "author" : "authors"}</span>
                </div>
                <ul className={styles.authors}>{p.shelves.map((s) => <AuthorRow key={s.author.id} s={s} d={d} q={q} />)}</ul>
              </section>
            ))}
            {d && titleParts.map((p) => (
              <section key={p.key} className={styles.part} aria-labelledby={`part-${p.key}`}>
                <div className={styles.partHead}>
                  <h3 id={`part-${p.key}`} className={styles.partName}>{p.label}</h3>
                  <span className={styles.partCount}>{n(p.works)} {p.works === 1 ? "work" : "works"}</span>
                </div>
                <ul className={styles.titles}>{p.rows.map((r) => <li key={r.work.id}><WorkLine w={r.work} d={d} q={q} by={r.author} /></li>)}</ul>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
