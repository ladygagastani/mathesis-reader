/** The catalogue built by the old repository's pipeline/build_catalog.py, read from the old site (config/packs.ts). */
import { CATALOG_URL } from "@/config/packs";

export type TextKind = "edition" | "translation" | "commentary";
export type CollectionId = "perseus" | "first1k";

export interface CatText {
  urn: string; kind: TextKind; lang: string | null;
  label: string | null; desc: string | null;
  col: CollectionId; path: string; size: number; sha: string;
}
/** `title` is English. Where the collection names a work only in Latin or Greek, its own title is `orig`, and
 *  `titleFrom` says where the English comes from: the library's English translation ("tr") or this site ("site"). */
export interface CatWork { id: string; title: string; orig?: string; titleFrom?: "tr" | "site"; lang: string | null; texts: CatText[] }
/** `name` is English. Where the collection files anonymous works, letters or lives under a Latin label (Vitae Homeri),
 *  that label is `orig` and `nameFrom` is "site": the English is this site's plain translation (pipeline/author_names.tsv). */
export interface CatAuthor { id: string; name: string; orig?: string; nameFrom?: "site"; works: CatWork[] }
export interface Catalog {
  built: string;
  collections: Record<CollectionId, { owner: string; repo: string; sha: string }>;
  authors: CatAuthor[];
}

export interface CatalogIndex {
  catalog: Catalog;
  work: Map<string, CatWork>;
  authorOf: Map<string, CatAuthor>;
  text: Map<string, CatText>;     // by URN
  author: Map<string, CatAuthor>;
}

let pending: Promise<CatalogIndex> | null = null;

export function loadCatalog(): Promise<CatalogIndex> {
  pending ??= fetch(CATALOG_URL)
    .then((r) => { if (!r.ok) throw new Error(`The catalogue could not be loaded (${r.status}).`); return r.json() as Promise<Catalog>; })
    .then(indexCatalog)
    .catch((e) => { pending = null; throw e; });
  return pending;
}

/** The catalogue indexed last, which describe() asks for a text's fellow editions when it is not given them. */
let lastIndex: CatalogIndex | null = null;

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const idx: CatalogIndex = { catalog, work: new Map(), authorOf: new Map(), text: new Map(), author: new Map() };
  for (const a of catalog.authors) {
    idx.author.set(a.id, a);
    for (const w of a.works) {
      idx.work.set(w.id, w);
      idx.authorOf.set(w.id, a);
      for (const t of w.texts) idx.text.set(t.urn, t);
    }
  }
  lastIndex = idx;
  return idx;
}

/** The short name a URN ends in, e.g. "perseus-grc2". */
export const versionOf = (urn: string) => urn.slice(urn.lastIndexOf(".") + 1);

export const greekEditions = (w: CatWork) => w.texts.filter((t) => t.kind === "edition" && t.lang === "grc");
/**
 * Translation files whose passage numbers drift out of step with the Greek, so that their English can stand a passage
 * away from the Greek it translates, found by scripts/audit-names.ts and read side by side. They are offered after the
 * others, and the reader says so when one is open.
 * - Lucian, Demonax, Harmon's English: about sections 28–43 one behind the Greek, about 45–64 one ahead (Fowler's agrees).
 */
export const OUT_OF_STEP = new Set(["urn:cts:greekLit:tlg0062.tlg008.perseus-eng2"]);
export const translations = (w: CatWork, lang = "eng") =>
  w.texts.filter((t) => t.kind === "translation" && t.lang === lang).sort((a, b) => Number(OUT_OF_STEP.has(a.urn)) - Number(OUT_OF_STEP.has(b.urn)));
export const hasTranslation = (w: CatWork) => translations(w).length > 0;

/** Where GitHub serves the file, pinned to the catalogue's exact version of the collection. */
export function rawUrl(idx: CatalogIndex, t: CatText) {
  const c = idx.catalog.collections[t.col];
  return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.sha}/${t.path}`;
}

/** "Murray, 1924" from the CTS description: the translator or editor, and the year of publication. */
function plainName(t: CatText): string {
  const d = t.desc ?? "";
  // "Butler, Samuel, 1835-1902, translator" → Butler; life dates are not the publication year
  const who = /([A-Z][\w'’-]+),\s*[A-Z][^,;]*?(?:,\s*[\d?]{4}\s*-\s*[\d?]{0,4})?,\s*(?:translator|editor)/.exec(d)?.[1];
  const year = /\b(1[5-9]\d\d|20\d\d)\b/.exec(d.replace(/[\d?]{4}\s*-\s*[\d?]{0,4},\s*(?:translator|editor)/g, ""))?.[1];
  return who ? `${who}${year ? `, ${year}` : ""}` : (t.label ?? versionOf(t.urn));
}

/** The work a text's URN belongs to ("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2" → "tlg0012.tlg001"). */
const workOfUrn = (urn: string) => urn.slice(urn.lastIndexOf(":") + 1, urn.lastIndexOf("."));

/**
 * Describe an edition or translation for a picker or a line of text: "Murray, 1924" style, from the CTS description.
 * The file's own short name ("perseus-grc2") is added only where another text of the same work, of the same kind and
 * language, would otherwise read the same (two printings of one edition, say), so that the two can be told apart.
 * `among` is the work's texts; when it is not given, the work is looked up in the catalogue loaded last.
 */
export function describe(t: CatText, among?: readonly CatText[]): string {
  // the private collection's books (lib/mine.ts) carry their own plain description
  if (t.urn.startsWith("mine:")) return t.desc ?? versionOf(t.urn);
  const base = plainName(t);
  const others = among ?? lastIndex?.work.get(workOfUrn(t.urn))?.texts ?? [];
  const twin = others.some((o) => o.urn !== t.urn && o.kind === t.kind && o.lang === t.lang && plainName(o) === base);
  return twin ? `${base} (${versionOf(t.urn)})` : base;
}
