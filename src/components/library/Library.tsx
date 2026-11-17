"use client";
/**
 * The library (SPEC.md, "The library"; DESIGN.md, "Library"), at /library: a short head, the search, then every work. (The books
 * you are reading, the books you saved and where to begin are on the start page, Home.tsx.) The list opens as one A to Z list of
 * authors (the owner, 2026-11-12), each author a row with their works beside them; it can also list the titles A to Z, or group
 * the authors by kind of writing or by period. With English or Greek only, a period, a dialect and how familiar the words are
 * narrow it. Each work says its Greek title, kind, date, length and vocabulary (lib/library/facts.ts). A rail of letters beside an
 * A to Z list jumps to a letter. The address keeps the search, the order and the filters (/library?q=plato&sort=kind&period=…),
 * so a reload or a link opens the same list.
 */
import { useSearchParams } from "next/navigation";
import { memo, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Icon from "@/components/Icon";
import { FIND_KEY } from "@/components/site/SlashSearch";
import { hasTranslation, type CatWork } from "@/lib/catalog";
import { bcAd } from "@/lib/library/bc-ad";
import { AZ_OTHER } from "@/lib/library/az";
import { bestShelf, byKind, byLetter, byPeriod, byTitle, shelves, type Part, type Shelf, type Show, type TitlePart } from "@/lib/library/catalogue";
import { dialects, passes, PERIODS, UNDATED, VOCAB, type Filters } from "@/lib/library/facts";
import { Marked, n, useCatalogue, WorkLine, type Loaded } from "./shared";
import styles from "./Library.module.css";

type Sort = "az" | "titles" | "kind" | "period";
const SHOWS: [Show, string][] = [["all", "All"], ["english", "With English"], ["greek", "Greek only"]];
const SORTS: [Sort, string][] = [["az", "Authors A–Z"], ["titles", "Titles A–Z"], ["kind", "By kind"], ["period", "By period"]];
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", AZ_OTHER];
/** an author shows this many works until "All n works" is pressed */
const FIRST = 6;
/** a new list is drawn this many rows (an author, or a title) at a time: the first at once, the rest in the background */
const CHUNK = 40;
/** An author: their names and who they were at the left, their works at the right. */
const AuthorRow = memo(function AuthorRow({ s, d, q }: { s: Shelf; d: Loaded; q: string }) {
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
});

/** The rail of letters beside an A to Z list: a letter jumps to its part; the letter you are reading under is marked. */
function Rail({ keys, whole, onWhole }: { keys: string[]; whole: boolean; onWhole: () => void }) {
  const [here, setHere] = useState("");
  useEffect(() => {
    const heads = keys.map((k) => document.getElementById(`part-${k}`)).filter((x): x is HTMLElement => !!x);
    const watch = new IntersectionObserver((seen) => {
      const top = seen.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setHere(top.target.id.slice(5));
    }, { rootMargin: "-56px 0px -70% 0px" });
    heads.forEach((h) => watch.observe(h));
    return () => watch.disconnect();
  }, [keys, whole]);
  // a letter whose part is not drawn yet (the list is still coming in): the rest is drawn at once, then the jump
  const jump = (e: React.MouseEvent, l: string) => {
    if (document.getElementById(`part-${l}`)) return;
    e.preventDefault();
    flushSync(onWhole);
    document.getElementById(`part-${l}`)?.scrollIntoView();
    if (location.hash !== `#part-${l}`) window.history.pushState(window.history.state, "", `#part-${l}`);
  };
  return (
    <nav className={styles.rail} aria-label="Letters">
      {LETTERS.map((l) => keys.includes(l)
        ? <a key={l} href={`#part-${l}`} aria-current={l === here ? "true" : undefined} onClick={(e) => jump(e, l)}>{l}</a>
        : <span key={l} aria-hidden="true">{l}</span>)}
    </nav>
  );
}

type Choices = { show: Show; sort: Sort } & Filters;

/** Each part's rows, as many as n rows in all reach, in order; a part not reached is null. */
function upTo<T>(lists: T[][], n: number): (T[] | null)[] {
  let left = n;
  return lists.map((xs) => {
    if (left <= 0) return null;
    const some = xs.slice(0, left);
    left -= some.length;
    return some;
  });
}

/** Every work, under its parts, with the rail of letters beside an A to Z list. A new list is drawn a piece at a time: the first
 *  CHUNK rows at once, then the rest a CHUNK at a time in the background, so no single step lays out 1,500 rows (at a quarter of a
 *  computer's speed that held the page for up to 1.7 s). Only this part of the page draws again for each piece. The finished page
 *  is the same as before. */
const Listing = memo(function Listing({ parts, titleParts, sort, best, d, q }: {
  parts: Part[]; titleParts: TitlePart[]; sort: Sort; best: Shelf | null; d: Loaded; q: string;
}) {
  const railKeys = sort === "az" ? parts.map((p) => p.key) : sort === "titles" ? titleParts.map((p) => p.key) : [];
  const shelvesOf = sort === "titles" ? titleParts : parts;
  const rows = useMemo(() => (sort === "titles" ? titleParts.reduce((k, p) => k + p.rows.length, 0) : parts.reduce((k, p) => k + p.shelves.length, 0)), [sort, parts, titleParts]);
  const [grown, setGrown] = useState<{ of: unknown; n: number }>({ of: null, n: CHUNK });
  const drawn = grown.of === shelvesOf ? grown.n : CHUNK;
  useEffect(() => {
    if (drawn >= rows) return;
    // when the browser is idle, so a scroll's frames come first (Safari has no requestIdleCallback: a frame's wait instead)
    const grow = () => startTransition(() => setGrown({ of: shelvesOf, n: drawn + CHUNK }));
    if ("requestIdleCallback" in window) { const id = requestIdleCallback(grow, { timeout: 500 }); return () => cancelIdleCallback(id); }
    const t = setTimeout(grow, 16);
    return () => clearTimeout(t);
  }, [drawn, rows, shelvesOf]);
  const whole = () => setGrown({ of: shelvesOf, n: Infinity });
  // each part with as many of its rows as the pieces drawn so far reach; a part not reached yet is left out
  const partRows = upTo(parts.map((p) => p.shelves), drawn);
  const titleRows = upTo(titleParts.map((p) => p.rows), drawn);
  return (
    // (data-drawn once every row stands: the checks wait for it, rather than measure rows still coming in)
    <div className={railKeys.length ? styles.withRail : undefined} data-drawn={drawn >= rows || undefined}>
      {railKeys.length > 0 && <Rail keys={railKeys} whole={drawn >= rows} onWhole={whole} />}
      <div className={styles.listCol}>
        {best && (
          <section className={styles.part} aria-label="Best match">
            <div className={styles.partHead}><h3 className={styles.partName}>Best match</h3></div>
            <ul className={styles.authors}><AuthorRow s={best} d={d} q={q} /></ul>
          </section>
        )}
        {parts.map((p, i) => {
          const some = partRows[i];
          return some && (
            <section key={p.key} className={styles.part} aria-labelledby={`part-${p.key}`}>
              <div className={styles.partHead}>
                <h3 id={`part-${p.key}`} className={styles.partName}>{p.label}</h3>
                <span className={styles.partCount}>{n(p.works)} {p.works === 1 ? "work" : "works"} · {n(p.shelves.length)} {p.shelves.length === 1 ? "author" : "authors"}</span>
              </div>
              <ul className={styles.authors}>{some.map((s) => <AuthorRow key={s.author.id} s={s} d={d} q={q} />)}</ul>
            </section>
          );
        })}
        {titleParts.map((p, i) => {
          const some = titleRows[i];
          return some && (
            <section key={p.key} className={styles.part} aria-labelledby={`part-${p.key}`}>
              <div className={styles.partHead}>
                <h3 id={`part-${p.key}`} className={styles.partName}>{p.label}</h3>
                <span className={styles.partCount}>{n(p.works)} {p.works === 1 ? "work" : "works"}</span>
              </div>
              <ul className={styles.titles}>{some.map((r) => <li key={r.work.id}><WorkLine w={r.work} d={d} q={q} by={r.author} /></li>)}</ul>
            </section>
          );
        })}
      </div>
    </div>
  );
});

export default function Library() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  // the choices live in the page, read from the address once as it opens, so a choice changes the list in place
  const [choice, setChoice] = useState<Choices>(() => ({
    show: (SHOWS.find(([s]) => s === params.get("show"))?.[0] ?? "all") as Show,
    sort: (SORTS.find(([s]) => s === params.get("sort"))?.[0] ?? "az") as Sort,
    period: params.get("period") ?? "", dialect: params.get("dialect") ?? "", vocab: params.get("vocab") ?? "",
  }));
  const { show, sort } = choice;
  const filters: Filters = { period: choice.period, dialect: choice.dialect, vocab: choice.vocab };
  const filtersOn = !!(filters.period || filters.dialect || filters.vocab);
  const got = useCatalogue();
  const field = useRef<HTMLInputElement>(null);

  // "/" on another page brought you here to search
  useEffect(() => {
    try { if (sessionStorage.getItem(FIND_KEY)) { sessionStorage.removeItem(FIND_KEY); field.current?.focus(); } } catch { /* storage blocked */ }
  }, []);

  const setParam = (patch: Partial<Choices>) => setChoice((c) => ({ ...c, ...patch }));
  const clearAll = () => { setQuery(""); setChoice((c) => ({ ...c, show: "all", period: "", dialect: "", vocab: "" })); };
  /** The address follows the search, the order and the filters, so a link or a reload opens the same list. It is replaced, not
   *  added to, so Back leaves the library, and written with the browser's own history call, not the router's: the router asked
   *  GitHub Pages for the library's data at "/mathesis-reader.txt", found nothing and loaded the whole page again at every choice
   *  (owner's note, 2026-11-14). The search is written once the typing pauses. */
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      const all = { q: query.trim(), ...choice };
      for (const [k, v] of Object.entries(all)) if (v && v !== "all" && v !== "az") q.set(k, v);
      const want = q.size ? `${location.pathname}?${q}` : location.pathname;
      if (want !== location.pathname + location.search) window.history.replaceState(window.history.state, "", want);
    }, 300);
    return () => clearTimeout(t);
  }, [query, choice]);

  const d = got.data;
  const keep = useMemo(() => (d && filtersOn ? (w: CatWork) => passes(w.id, filters, d.meta, d.diff) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, filters.period, filters.dialect, filters.vocab]);
  const list = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, query, show, keep) : []), [d, query, show, keep]);
  const all = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, "", "all") : []), [d]);
  const parts = useMemo(() => (!d ? [] : sort === "az" ? byLetter(list) : sort === "kind" ? byKind(list, d.kinds) : sort === "period" ? byPeriod(list, d.meta) : []), [d, list, sort]);
  const titleParts: TitlePart[] = useMemo(() => (d && sort === "titles" ? byTitle(list) : []), [d, list, sort]);
  const best = useMemo(() => (d && sort !== "titles" ? bestShelf(list, d.names, query) : null), [d, sort, list, query]);
  const total = all.reduce((k, s) => k + s.works.length, 0);
  const english = all.reduce((k, s) => k + s.works.filter(hasTranslation).length, 0);
  const shown = list.reduce((k, s) => k + s.works.length, 0);
  const dialectList = useMemo(() => (d ? dialects(d.meta) : []), [d]);

  const q = query.trim();
  // The list's rows follow a moment behind. The list itself (which works, how many) changes at once, but its 1,822 rows drawn
  // at once held a phone for a second or more after each tap. Deferred, React draws them in the background and gives way to any
  // tap meanwhile, and the old rows dim until the new ones stand (Library.module.css, data-stale).
  const drawnNow = useMemo(() => ({ parts, titleParts, sort, best, q }), [parts, titleParts, sort, best, q]);
  const view = useDeferredValue(drawnNow);
  // (dimmed only where there are old rows to dim: not while the catalogue first arrives)
  const stale = view !== drawnNow && (view.parts.length > 0 || view.titleParts.length > 0 || !!view.best);

  return (
    <main id="main" className={`wrap ${styles.library}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>The library <span lang="grc" className={styles.titleGr}>Μουσεῖον</span></h1>
        <p className={styles.purpose}>
          {d ? `${n(total)} Greek works by ${n(all.length)} authors, ${n(english)} of them with an English translation. ` : ""}
          Open one and read it in Greek, with every word explained on the line.
        </p>
      </header>

      {/* a form, so the keyboard's Search key (Enter) closes the keyboard and brings the list into view; the list follows the
          letters as they are typed, so nothing else is sent */}
      <form role="search" className={styles.find} onSubmit={(e) => {
        e.preventDefault();
        field.current?.blur();
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("every-work")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
      }}>
        <label className={styles.field}>
          <span className="label">Search the library</span>
          <span className={styles.fieldRow}>
            <Icon name="search" className={styles.fieldSign} />
            <input ref={field} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="an author or a title, in English or Greek"
              enterKeyHint="search" autoComplete="off" spellCheck={false} aria-describedby="find-key" />
            <kbd id="find-key" className={styles.key} title="Press / on any page to search the library">/</kbd>
          </span>
        </label>
      </form>

      <div className={styles.controls}>
        <div className={styles.control}>
          <span className="label" id="show-label">Show</span>
          <div className="segmented" role="radiogroup" aria-labelledby="show-label">
            {SHOWS.map(([s, label]) => <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setParam({ show: s })}>{label}</button>)}
          </div>
        </div>
        <div className={styles.control}>
          <span className="label" id="order-label">Order</span>
          <div className={`segmented ${styles.order}`} role="radiogroup" aria-labelledby="order-label">
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

      <section className={styles.all} aria-labelledby="every-work" data-stale={stale || undefined}>
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

        {d && <Listing parts={view.parts} titleParts={view.titleParts} sort={view.sort} best={view.best} d={d} q={view.q} />}
      </section>
    </main>
  );
}
