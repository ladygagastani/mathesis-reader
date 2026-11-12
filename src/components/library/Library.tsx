"use client";
/**
 * The library (SPEC.md, "The library"; ADR 0008, decision 11): the search first, then every work, by kind of writing with authors
 * A to Z inside each, or as one A to Z list of authors. An author with one work opens it at once; one with several shows them.
 * The address keeps the search (/?q=plato&show=english&sort=az), so the browser's Back returns to the same list.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { loadAuthorNames, type AuthorNames } from "@/lib/authors";
import { hasTranslation, loadCatalog, type CatalogIndex, type CatWork } from "@/lib/catalog";
import { bcAd } from "@/lib/library/bc-ad";
import { bestShelf, byKind, byLetter, shelves, type Shelf, type Show } from "@/lib/library/catalogue";
import { loadAuthorsMeta, loadWorksMeta, workKinds, type AuthorMeta } from "@/lib/library/kinds";
import styles from "./Library.module.css";

type Sort = "kind" | "az";
const SHOWS: [Show, string][] = [["all", "All"], ["english", "With English"], ["greek", "Greek only"]];
const SORTS: [Sort, string][] = [["kind", "By kind"], ["az", "Authors A–Z"]];
const n = (x: number) => x.toLocaleString("en-GB");

interface Loaded { idx: CatalogIndex; names: Record<string, AuthorNames>; who: Record<string, AuthorMeta>; kinds: Map<string, string> }

function WorkLink({ w }: { w: CatWork }) {
  return (
    <Link className={styles.work} href={`/read?w=${w.id}`}>
      <span className={styles.workTitle}>{w.title}</span>
      {hasTranslation(w) && <span className={styles.note}>with English</span>}
      <Icon name="next" className={styles.go} />
    </Link>
  );
}

function ShelfRow({ s, names, who }: { s: Shelf; names: Record<string, AuthorNames>; who: Record<string, AuthorMeta> }) {
  const [open, setOpen] = useState(false);
  const grc = names[s.author.id]?.grc;
  const desc = who[s.author.id]?.desc;
  const head = (
    <>
      <span className={styles.name}>{s.author.name}{grc && grc !== s.author.name && <span lang="grc" className={styles.grc}>{grc}</span>}</span>
      {desc && <span className={styles.desc}>{bcAd(desc)}</span>}
    </>
  );
  if (s.works.length === 1) {
    const w = s.works[0];
    return (
      <li className={styles.shelf}>
        <Link className={styles.row} href={`/read?w=${w.id}`}>
          <span className={styles.who}>{head}<span className={styles.one}><i>{w.title}</i>{hasTranslation(w) && <span className={styles.note}>with English</span>}</span></span>
          <Icon name="next" className={styles.go} />
        </Link>
      </li>
    );
  }
  return (
    <li className={styles.shelf}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={styles.who}>{head}<span className={styles.note}>{s.works.length} works</span></span>
        <Icon name={open ? "chevron-up" : "chevron-down"} className={styles.go} />
      </button>
      {open && <ul className={styles.works}>{s.works.map((w) => <li key={w.id}><WorkLink w={w} /></li>)}</ul>}
    </li>
  );
}

export default function Library({ before }: { before?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const show = (SHOWS.find(([s]) => s === params.get("show"))?.[0] ?? "all") as Show;
  const sort = (params.get("sort") === "az" ? "az" : "kind") as Sort;
  const [got, setGot] = useState<{ data?: Loaded; error?: string }>({});

  useEffect(() => {
    let live = true;
    Promise.all([loadCatalog(), loadAuthorNames(), loadWorksMeta(), loadAuthorsMeta()])
      .then(([idx, names, meta, who]) => { if (live) setGot({ data: { idx, names, who, kinds: workKinds(idx.catalog.authors, meta, who) } }); })
      .catch((e: Error) => { if (live) setGot({ error: e.message }); });
    return () => { live = false; };
  }, []);

  /** the address follows the search and the choices, replaced rather than added to, so Back leaves the library */
  const setParam = (patch: Record<string, string>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v && v !== "all" && v !== "kind") q.set(k, v); else q.delete(k); }
    router.replace(q.size ? `/?${q}` : "/", { scroll: false });
  };
  useEffect(() => {
    const t = setTimeout(() => { if ((params.get("q") ?? "") !== query.trim()) setParam({ q: query.trim() }); }, 300);
    return () => clearTimeout(t);
  });

  const d = got.data;
  const list = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, query, show) : []), [d, query, show]);
  const all = useMemo(() => (d ? shelves(d.idx.catalog.authors, d.names, "", "all") : []), [d]);
  const parts = useMemo(() => (d ? (sort === "az" ? byLetter(list) : byKind(list, d.kinds)) : []), [d, list, sort]);
  const best = d ? bestShelf(list, d.names, query) : null;
  const total = all.reduce((k, s) => k + s.works.length, 0);
  const english = all.reduce((k, s) => k + s.works.filter(hasTranslation).length, 0);
  const shown = list.reduce((k, s) => k + s.works.length, 0);

  return (
    <main id="main" className={`wrap ${styles.library}`}>
      <header className={`${styles.head} enter`}>
        <h1 className={styles.title}>The library <span lang="grc" className={styles.titleGr}>Μουσεῖον</span></h1>
        <p className={styles.purpose}>
          {d ? `${n(total)} Greek works by ${n(all.length)} authors, ${n(english)} of them with an English translation. ` : ""}
          Open one and read it in Greek, with every word explained on the line.
        </p>
      </header>

      {before}

      <search className={styles.find}>
        <label className={styles.field}>
          <span className="label">Search</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="an author or a title, in English or Greek" autoComplete="off" spellCheck={false} />
        </label>
        <div className={styles.show} role="radiogroup" aria-label="Show">
          {SHOWS.map(([s, label]) => (
            <button key={s} type="button" role="radio" aria-checked={show === s} onClick={() => setParam({ show: s })}>{label}</button>
          ))}
        </div>
      </search>

      <section className={styles.all} aria-labelledby="every-work">
        <div className={styles.allHead}>
          <h2 id="every-work">Every work in the library</h2>
          {d && <p className={styles.count} aria-live="polite">{shown === total ? `${n(total)} works` : `${n(shown)} of ${n(total)} works`}</p>}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Order">
          {SORTS.map(([s, label]) => <button key={s} type="button" role="radio" aria-checked={sort === s} onClick={() => setParam({ sort: s })}>{label}</button>)}
        </div>

        {got.error && <p className={styles.status}>The catalogue could not be loaded ({got.error}). <button type="button" className="text-btn" onClick={() => location.reload()}>Try again</button></p>}
        {!d && !got.error && <p className={`muted ${styles.status}`} aria-busy="true">Opening the catalogue…</p>}
        {d && !list.length && <p className={styles.status}>No work in the library matches {`"${query.trim()}"`}{show !== "all" ? ` with this choice (${SHOWS.find(([s]) => s === show)![1]})` : ""}.</p>}

        {d && best && (
          <section className={styles.part} aria-label="Best match">
            <div className={styles.partHead}><h3 className={styles.partName}>Best match</h3></div>
            <ul className={styles.shelves}><ShelfRow s={best} names={d.names} who={d.who} /></ul>
          </section>
        )}
        {d && parts.map((p) => (
          <section key={p.key} className={styles.part} aria-labelledby={`part-${p.key}`}>
            <div className={styles.partHead}>
              <h3 id={`part-${p.key}`} className={styles.partName}>{p.label}</h3>
              <span className={styles.partCount}>{p.works} {p.works === 1 ? "work" : "works"} · {p.shelves.length} {p.shelves.length === 1 ? "author" : "authors"}</span>
            </div>
            <ul className={styles.shelves}>{p.shelves.map((s) => <ShelfRow key={s.author.id} s={s} names={d.names} who={d.who} />)}</ul>
          </section>
        ))}
      </section>
    </main>
  );
}
