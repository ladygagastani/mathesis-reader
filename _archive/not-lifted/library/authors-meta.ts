/**
 * Who each author was, from Wikidata (web/public/data/authors-meta.json, built by
 * pipeline/build_authors_meta.py; CC0), with GLAUx's dates and genres (works-meta.json) filling the gaps.
 * The Wiki's Authors and Eras pages read this. Nothing here is written by hand except the period
 * boundaries (the usual conventions) and which occupations count as which kind of writing.
 */
import { hasTranslation, type CatAuthor } from "./catalog";
import { centuries, familyOf, type WorkMeta } from "./works-meta";
import { bcAd } from "./bc-ad";

export interface AuthorMeta {
  q: string;
  /** [historical year, Wikidata's precision: 9 year, 8 decade, 7 century]; negative = BC */
  birth?: [number, number]; death?: [number, number]; flor?: [number, number];
  desc?: string; place?: string; occ?: string[]; wp?: string;
}

/** Wikidata's descriptions in the site's own dates, BC and AD (lib/bc-ad.ts) */
export function tidyAuthors(authors: Record<string, AuthorMeta>): Record<string, AuthorMeta> {
  for (const a of Object.values(authors)) if (a.desc) a.desc = bcAd(a.desc);
  return authors;
}

let pending: Promise<Record<string, AuthorMeta>> | null = null;
export function loadAuthorsMeta(): Promise<Record<string, AuthorMeta>> {
  pending ??= fetch("/data/authors-meta.json").then((r) => (r.ok ? r.json() : { authors: {} })).then((d) => tidyAuthors(d.authors ?? {})).catch(() => ({}));
  return pending;
}

/** Each author's Ancient Greek name and the other names they go by, from Wikidata's labels and aliases
 * (web/public/data/author-names.json, built by pipeline/build_author_names.py; CC0), for the library's search. */
export interface AuthorNames { grc?: string; also?: string[] }
let namesPending: Promise<Record<string, AuthorNames>> | null = null;
export function loadAuthorNames(): Promise<Record<string, AuthorNames>> {
  namesPending ??= fetch("/data/author-names.json").then((r) => (r.ok ? r.json() : { authors: {} })).then((d) => d.authors ?? {}).catch(() => ({}));
  return namesPending;
}

/** The periods of Greek, by the usual conventions. `to` is the last year of the period (BC negative). */
export interface Era { id: string; name: string; from: number; to: number; span: string }
export const ERAS: Era[] = [
  { id: "archaic", name: "Archaic", from: -800, to: -480, span: "800–480 BC" },
  { id: "classical", name: "Classical", from: -479, to: -323, span: "480–323 BC" },
  { id: "hellenistic", name: "Hellenistic", from: -322, to: -31, span: "323–31 BC" },
  { id: "imperial", name: "Roman Imperial", from: -30, to: 330, span: "31 BC – AD 330" },
  { id: "lateantique", name: "Late Antique", from: 331, to: 620, span: "AD 330–620" },
  { id: "byzantine", name: "Byzantine", from: 621, to: 1453, span: "AD 620–1453" },
];
export const eraById = (id: string | null | undefined) => ERAS.find((e) => e.id === id);

/** The era a year falls in. Years before 800 BC count as Archaic, years after 1453 as Byzantine. */
export function eraOfYear(y: number): Era {
  return ERAS.find((e) => y <= e.to) ?? ERAS[ERAS.length - 1];
}

/**
 * The year to place an author by, and how it was found. When Wikidata gives a floruit, that; when it gives
 * both birth and death, the middle of their adult life (from age 25 to death, so a long-lived author is not placed by their childhood); with only one of them, that one. Otherwise the middle of the
 * span GLAUx gives for the author's works (by century of life). Null when nothing dates the author.
 */
export function placingYear(m: AuthorMeta | undefined, works: (WorkMeta | undefined)[]): { year: number; from: "wikidata" | "glaux" } | null {
  if (m?.flor) return { year: m.flor[0], from: "wikidata" };
  if (m?.birth && m?.death) return { year: Math.round((Math.min(m.birth[0] + 25, m.death[0]) + m.death[0]) / 2), from: "wikidata" };
  const one = m?.birth ?? m?.death;
  if (one) return { year: one[0], from: "wikidata" };
  const froms = works.map((w) => w?.from).filter((x): x is number => typeof x === "number");
  const tos = works.map((w) => w?.to).filter((x): x is number => typeof x === "number");
  if (froms.length && tos.length) return { year: Math.round((Math.min(...froms) + Math.max(...tos)) / 2), from: "glaux" };
  return null;
}

/** Kinds of writing an author is filed under: families of their works (GLAUx), plus what Wikidata calls their occupation. */
export const KINDS: [id: string, label: string, occupations: string[]][] = [
  ["Epic", "Epic", ["epic poet"]],
  ["Lyric and elegy", "Lyric and elegy", ["lyric poet", "elegist", "epigrammatist"]],
  ["Drama", "Drama", ["playwright", "tragedian", "comedian", "dramatist", "comedy writer", "tragedy writer"]],
  ["History and biography", "History and biography", ["historian", "biographer", "geographer", "military historian", "chronicler"]],
  ["Philosophy", "Philosophy", ["philosopher", "philosopher of law", "sophist", "neoplatonist", "stoic"]],
  ["Oratory and rhetoric", "Oratory and rhetoric", ["orator", "rhetorician", "logographer", "speechwriter"]],
  ["Medicine", "Medicine", ["physician", "medical writer", "physician writer", "iatrosophist", "pharmacologist"]],
  ["Science and mathematics", "Science and mathematics", ["mathematician", "astronomer", "astrologer", "engineer", "physicist", "natural philosopher", "scientist", "botanist", "alchemist"]],
  ["Novels, myths and marvels", "Novels, myths and marvels", ["novelist", "satirist", "mythographer", "fabulist", "paradoxographer"]],
  ["Religion", "Religion", ["theologian", "bishop", "priest", "saint", "monk", "church father", "patriarch", "apologist", "archbishop", "cleric", "christian minister", "presbyter", "deacon", "pope of the coptic orthodox church"]],
  ["Scholarship", "Scholarship", ["grammarian", "lexicographer", "literary critic", "scholar", "commentator", "philologist"]],
];

/**
 * The kinds of writing for one author: the families of their works where GLAUx has classified them, and only
 * otherwise what Wikidata calls their occupation (which is looser: Sophocles is listed there as a philosopher too).
 */
export function kindsOf(m: AuthorMeta | undefined, works: (WorkMeta | undefined)[]): string[] {
  const out = new Set<string>();
  for (const w of works) { const f = familyOf(w?.genre ?? null); if (f && f !== "Letters") out.add(f); }
  if (!out.size) {
    const occ = new Set((m?.occ ?? []).map((o) => o.toLowerCase()));
    for (const [id, , os] of KINDS) if (os.some((o) => occ.has(o))) out.add(id);
  }
  return KINDS.map(([id]) => id).filter((id) => out.has(id));
}

/** "5th c. BC" for a year, "1st c. AD" (500–401 BC is the 5th century BC; AD 1–100 the 1st). */
export function centuryOfYear(y: number): string {
  const n = y < 0 ? Math.ceil(-y / 100) : Math.floor((y - 1) / 100) + 1;
  const suf = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suf} c. ${y < 0 ? "BC" : "AD"}`;
}

/** The centuries an author's life spans: "5th–4th c. BC", "1st c. AD", or null without dates. */
export function lifeSpan(m: AuthorMeta | undefined): string | null {
  const ys = [m?.birth?.[0], m?.death?.[0], m?.flor?.[0]].filter((y): y is number => typeof y === "number");
  if (!ys.length) return null;
  const a = centuryOfYear(Math.min(...ys)), b = centuryOfYear(Math.max(...ys));
  if (a === b) return a;
  const [an, aera] = a.split(" c. "), [bn, bera] = b.split(" c. ");
  return aera === bera ? `${an}–${bn} c. ${aera}` : `${a} – ${b}`;
}

/** Everything the Wiki's author pages show about one author. */
export interface AuthorRow {
  a: CatAuthor; meta: AuthorMeta | undefined;
  era: Era | null; year: number | null; kinds: string[];
  /** the centuries of their life ("5th–4th c. BC"): from Wikidata, or from GLAUx's dating of their works (`estimated`) */
  span: string | null; estimated: boolean;
  works: number; english: number;
  /** GLAUx's metadata for each work, for the counts by dialect and kind */
  workMeta: (WorkMeta | undefined)[];
}

export function authorRows(authors: CatAuthor[], meta: Record<string, AuthorMeta>, wmeta: Record<string, WorkMeta>): AuthorRow[] {
  return authors.map((a) => {
    const ws = a.works.map((w) => wmeta[w.id]);
    const m = meta[a.id];
    const p = placingYear(m, ws);
    const froms = ws.map((w) => w?.from).filter((x): x is number => typeof x === "number");
    const tos = ws.map((w) => w?.to).filter((x): x is number => typeof x === "number");
    const own = lifeSpan(m);
    const span = own ?? (froms.length && tos.length ? centuries(Math.min(...froms), Math.max(...tos)) : null);
    return {
      a, meta: m, era: p ? eraOfYear(p.year) : null, year: p?.year ?? null, kinds: kindsOf(m, ws),
      span, estimated: !own && !!span, works: a.works.length, english: a.works.filter(hasTranslation).length, workMeta: ws,
    };
  });
}
