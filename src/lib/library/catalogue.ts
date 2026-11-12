/**
 * The library's list (ADR 0008, decision 11; SPEC.md, "The library"): a search first, then the catalogue. The search keeps the
 * works whose author or title it names, in English, Latin or Greek, accents and capitals aside: an author it names keeps all
 * their works; otherwise the works whose own title it names. "With English" and "Greek only" narrow it further. The catalogue
 * sets what is kept by kind of writing (authors A to Z inside each), or as one A to Z list of authors. Only works with a Greek
 * text are listed: the reader opens on the Greek.
 */
import { greekEditions, hasTranslation, type CatAuthor, type CatWork } from "@/lib/catalog";
import { fold } from "@/lib/greek";
import type { AuthorNames } from "@/lib/authors";
import { bestMatch, compareAZ, groupAZ, nameMatch } from "./az";
import { KIND_ORDER, kindKey } from "./kinds";

export type Show = "all" | "english" | "greek";
/** An author and the works of theirs that are kept. */
export interface Shelf { author: CatAuthor; works: CatWork[] }
/** A part of the catalogue: a kind of writing, or a letter. */
export interface Part { key: string; label: string; shelves: Shelf[]; works: number }

const readable = (w: CatWork) => greekEditions(w).length > 0;
const shows = (w: CatWork, show: Show) => show === "all" || hasTranslation(w) === (show === "english");

/** Every name an author goes by, for the search. */
const namesOf = (a: CatAuthor, n: AuthorNames | undefined) => [a.name, a.orig, n?.grc, ...(n?.also ?? [])];
/** Every title a work goes by: English, the collection's own (Latin or Greek), and its Greek edition's. */
const titlesOf = (w: CatWork) => [w.title, w.orig, ...greekEditions(w).map((t) => t.label ?? undefined)];

/** The authors, A to Z, with the works the search and the choice keep. */
export function shelves(authors: CatAuthor[], names: Record<string, AuthorNames>, query: string, show: Show): Shelf[] {
  const q = fold(query.trim());
  const out: Shelf[] = [];
  for (const author of authors) {
    const all = author.works.filter((w) => readable(w) && shows(w, show));
    const byName = !q || nameMatch(namesOf(author, names[author.id]), q) >= 0;
    const works = byName ? all : all.filter((w) => titlesOf(w).some((t) => t && fold(t).includes(q)));
    if (works.length) out.push({ author, works: [...works].sort((x, y) => compareAZ(x.title, y.title)) });
  }
  return out.sort((x, y) => compareAZ(x.author.name, y.author.name));
}

/** The one author the search plainly names, to stand first ("plato" names Plato, not Pseudo-Plato). */
export function bestShelf(list: Shelf[], names: Record<string, AuthorNames>, query: string): Shelf | null {
  const q = fold(query.trim());
  return q ? bestMatch(list, (s) => nameMatch(namesOf(s.author, names[s.author.id]), q)) : null;
}

const count = (ss: Shelf[]) => ss.reduce((n, s) => n + s.works.length, 0);

/** By kind of writing, in the catalogue's order; an author who wrote in several kinds stands under each, with those works. */
export function byKind(list: Shelf[], kinds: Map<string, string>): Part[] {
  return KIND_ORDER.map((kind) => {
    const ss = list.map((s) => ({ author: s.author, works: s.works.filter((w) => (kinds.get(w.id) ?? KIND_ORDER.at(-1)) === kind) })).filter((s) => s.works.length);
    return { key: kindKey(kind), label: kind, shelves: ss, works: count(ss) };
  }).filter((p) => p.shelves.length);
}

/** One list of authors, A to Z, under each letter. */
export function byLetter(list: Shelf[]): Part[] {
  return groupAZ(list.map((s) => ({ ...s, title: s.author.name }))).map((g) => ({ key: g.key, label: g.key, shelves: g.items, works: count(g.items) }));
}
