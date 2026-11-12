/**
 * The kind of writing each work is filed under in the library's catalogue (the old app's ADR 0008, decision 11: "the catalogue
 * grouped by kind (Epic, History, Philosophy, Drama, Medicine and so on), authors A to Z inside each"). Lifted from the old app's
 * components/library/kinds.ts, lib/works-meta.ts and lib/authors-meta.ts, with only what the catalogue needs.
 *
 * GLAUx's classification of the work comes first (the old site's data/works-meta.json). About a third of the works have none;
 * such a work is filed with its author's usual kind: the kind of most of the author's classified works; else, for a collection
 * named by what it is, that ("Scholia on Pindar" is scholarship, "Letters of Phalaris" letters); else what Wikidata says the
 * author was (data/authors-meta.json, CC0: "rhetorician" is oratory and rhetoric). Anything left is "Other writings".
 */
import { DATA_SITE } from "@/config/packs";
import type { CatAuthor } from "@/lib/catalog";

/** GLAUx's metadata for a work (only its genre is used here) */
export interface WorkMeta { genre: string | null }
/** Wikidata's facts about an author: what they were, and the description the library shows under the name */
export interface AuthorMeta { occ?: string[]; desc?: string }

function load<T>(file: string, key: string): () => Promise<Record<string, T>> {
  let pending: Promise<Record<string, T>> | null = null;
  return () => (pending ??= fetch(`${DATA_SITE}/data/${file}`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Record<string, Record<string, T> | undefined>) => d[key] ?? {})
    .catch(() => ({})));
}
export const loadWorksMeta = load<WorkMeta>("works-meta.json", "works");
export const loadAuthorsMeta = load<AuthorMeta>("authors-meta.json", "authors");

/** The kinds, in the catalogue's order, each with the GLAUx genres it holds. */
const FAMILIES: [string, string[]][] = [
  ["Epic", ["Epic poetry"]],
  ["Lyric and elegy", ["Lyric poetry"]],
  ["Drama", ["Tragedy", "Comedy"]],
  ["History and biography", ["History", "Biography", "Military", "Geography"]],
  ["Philosophy", ["Philosophy", "Philosophic Dialogue", "Dialogue"]],
  ["Oratory and rhetoric", ["Oratory", "Rhetoric"]],
  ["Letters", ["Epistolography"]],
  ["Medicine", ["Medicine", "Biology"]],
  ["Science and mathematics", ["Mathematics", "Astronomy/Astrology", "Physics", "Engineering", "Scientific Poetry", "Music", "Alchemy"]],
  ["Novels, myths and marvels", ["Narrative", "Mythography", "Paradoxography"]],
  ["Religion", ["Theology", "Religious Epistle", "Religious History", "Religious Prophecy", "Religious Narrative", "Religious Poetry", "Religious Wisdom"]],
  ["Scholarship", ["Commentary", "Language", "Polyhistory", "Art", "Oneirocritic"]],
];
const familyOf = (genre: string | null) => (genre ? FAMILIES.find(([, gs]) => gs.includes(genre))?.[0] ?? null : null);

/** What Wikidata's occupations say an author wrote, in the catalogue's order. */
const OCCUPATIONS: [kind: string, occupations: string[]][] = [
  ["Epic", ["epic poet"]],
  ["Lyric and elegy", ["lyric poet", "elegist", "epigrammatist"]],
  ["Drama", ["playwright", "tragedian", "comedian", "dramatist", "comedy writer", "tragedy writer"]],
  ["History and biography", ["historian", "biographer", "geographer", "military historian", "chronicler"]],
  ["Philosophy", ["philosopher", "philosopher of law", "sophist", "neoplatonist", "stoic"]],
  ["Oratory and rhetoric", ["orator", "rhetorician", "logographer", "speechwriter"]],
  ["Medicine", ["physician", "medical writer", "physician writer", "iatrosophist", "pharmacologist"]],
  ["Science and mathematics", ["mathematician", "astronomer", "astrologer", "engineer", "physicist", "natural philosopher", "scientist", "botanist", "alchemist"]],
  ["Novels, myths and marvels", ["novelist", "satirist", "mythographer", "fabulist", "paradoxographer"]],
  ["Religion", ["theologian", "bishop", "priest", "saint", "monk", "church father", "patriarch", "apologist", "archbishop", "cleric", "christian minister", "presbyter", "deacon", "pope of the coptic orthodox church"]],
  ["Scholarship", ["grammarian", "lexicographer", "literary critic", "scholar", "commentator", "philologist"]],
];

export const OTHER_KIND = "Other writings";
/** Every kind, in the catalogue's order, then the works filed under none. */
export const KIND_ORDER: string[] = [...FAMILIES.map(([f]) => f), OTHER_KIND];

/** A collection named by what it is. */
const NAMED: [RegExp, string][] = [
  [/^(?:scholia on|anonymous commentar(?:y|ies) on|commentar(?:y|ies) on)\b/i, "Scholarship"],
  [/^letters? of\b/i, "Letters"],
];

/** The kind with the most works; a tie goes to the kind that comes first in the catalogue. */
function most(count: Map<string, number>): string | null {
  let best: string | null = null;
  for (const k of KIND_ORDER) if (count.has(k) && (best === null || count.get(k)! > count.get(best)!)) best = k;
  return best;
}

/** The kind an author's unclassified works are filed under, or null. */
function usualKind(a: CatAuthor, meta: Record<string, WorkMeta>, who: AuthorMeta | undefined): string | null {
  const count = new Map<string, number>();
  for (const w of a.works) { const f = familyOf(meta[w.id]?.genre ?? null); if (f) count.set(f, (count.get(f) ?? 0) + 1); }
  if (count.size) return most(count);
  const named = NAMED.find(([re]) => re.test(a.name));
  if (named) return named[1];
  const occ = new Set((who?.occ ?? []).map((o) => o.toLowerCase()));
  return OCCUPATIONS.find(([, os]) => os.some((o) => occ.has(o)))?.[0] ?? null;
}

/** Each work's kind, by its id. */
export function workKinds(authors: CatAuthor[], meta: Record<string, WorkMeta>, who: Record<string, AuthorMeta>): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of authors) {
    let usual: string | null | undefined;
    for (const w of a.works) {
      const f = familyOf(meta[w.id]?.genre ?? null);
      if (f) { out.set(w.id, f); continue; }
      if (usual === undefined) usual = usualKind(a, meta, who[a.id]);
      out.set(w.id, usual ?? OTHER_KIND);
    }
  }
  return out;
}

/** The address of a kind's part of the list: "Lyric and elegy" is "lyric-and-elegy". */
export const kindKey = (k: string) => k.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
