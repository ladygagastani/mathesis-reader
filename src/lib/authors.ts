/**
 * Each author's Ancient Greek name and the other names they go by, from Wikidata's labels and aliases (CC0), read from the old
 * site's data/author-names.json (built there by pipeline/build_author_names.py): the title page's name, and the library's search.
 */
import { DATA_SITE } from "@/config/packs";

export interface AuthorNames { grc?: string; also?: string[] }

let pending: Promise<Record<string, AuthorNames>> | null = null;
export function loadAuthorNames(): Promise<Record<string, AuthorNames>> {
  pending ??= fetch(`${DATA_SITE}/data/author-names.json`)
    .then((r) => (r.ok ? r.json() : { authors: {} }))
    .then((d: { authors?: Record<string, AuthorNames> }) => d.authors ?? {})
    .catch(() => ({}));
  return pending;
}

/** Greek set in capitals as print sets it: accented capitals are not printed, so the marks go ("Πλάτων" → "ΠΛΑΤΩΝ"). */
export const titleCaps = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleUpperCase("el").normalize("NFC");
