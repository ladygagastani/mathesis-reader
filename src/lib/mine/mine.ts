/**
 * The private collection in the site's reader (owner's request, 2026-10-14): the moderator's own translations, and the
 * texts they import, open in /read like any other book (/read?w=mine:<id>), so every reading aid works on them.
 *
 * The text comes only from the database (lib/private-translations-db.ts, the moderator alone can read it); nothing of it
 * is in the site's code. This file holds only how a stored document (lib/private-translations.ts) becomes a book the
 * reader can show: a catalogue entry made up on the spot, and the Greek and the English as parsed texts, in the shape
 * the reader gets from a TEI file (lib/tei). Each row of the document is one passage of the reader, cited by its own
 * reference where the rows' references allow it (citation, below), else numbered passage.row ("3.12"); a row's label, or
 * a reference shared by several rows ("K II 6", "1097a15"), is shown as a marker at the start of its Greek.
 * Tested with placeholder text only (mine.test.ts).
 */
import type { CatAuthor, CatText, CatWork } from "@/lib/catalog";
import { hasPublished, parseRich, plainText, type RichNode, type TranslationDoc } from "./private-translations";
import { placePieces, translationPieces } from "@/lib/tei/align";
import type { Parsed } from "@/lib/tei/client";
import type { Block, TeiDoc, Unit } from "@/lib/tei/types";

export const MINE = "mine:";
export const isMine = (work: string | null | undefined): work is string => !!work && work.startsWith(MINE);
export const mineId = (work: string) => work.slice(MINE.length);
export const mineWorkId = (id: string) => `${MINE}${id}`;
/** A book of the private collection in the reader. */
export const mineHref = (id: string) => `/read?w=${mineWorkId(id)}`;

/** The two Englishes a stored document may hold, as the reader's translation menu offers them. */
export type MineVersion = "ours" | "published";
const LEVELS = ["passage", "row"];
/** Names for a document's own references, by how many parts they have ("2.14": chapter and section). */
const OWN_LEVELS: Record<number, string[]> = { 1: ["section"], 2: ["chapter", "section"], 3: ["book", "chapter", "section"] };

/**
 * The references the reader cites the rows by: the document's own when every row has one, none is repeated and all have
 * the same number of parts (a text imported from TEI, say, cited "1.33"); otherwise passage.row ("3.12").
 */
function citation(doc: TranslationDoc): { levels: string[]; ref: (pi: number, ri: number) => string[]; own: boolean } {
  const refs = doc.passages.flatMap((p) => p.rows.map((r) => r.ref ?? ""));
  const depth = new Set(refs.map((r) => r.split(".").length));
  const own = refs.every((r) => /^[^\s.]+(\.[^\s.]+)*$/.test(r)) && new Set(refs).size === refs.length && depth.size === 1 && !!OWN_LEVELS[[...depth][0]];
  if (own) return { levels: OWN_LEVELS[[...depth][0]], ref: (pi, ri) => doc.passages[pi].rows[ri].ref!.split("."), own };
  return { levels: LEVELS, ref: (pi, ri) => [String(pi + 1), String(ri + 1)], own };
}

/** The made-up catalogue entry: one Greek text and the Englishes the document holds. */
export function mineBook(doc: TranslationDoc): { work: CatWork; author: CatAuthor } {
  const base = mineWorkId(doc.id);
  const text = (v: string, kind: CatText["kind"], lang: string, label: string | null, desc: string): CatText =>
    ({ urn: `${base}.${v}`, kind, lang, label, desc, col: "perseus", path: "", size: 0, sha: "" });
  const imported = doc.status === "imported";
  const texts: CatText[] = [text("grc", "edition", "grc", doc.greekTitle ? plainText(doc.greekTitle) : null, imported ? "Imported" : "Private collection")];
  if (doc.passages.some((p) => p.rows.some((r) => r.english))) texts.push(text("ours", "translation", "eng", null, imported ? "English" : "Our English"));
  if (hasPublished(doc)) texts.push(text("published", "translation", "eng", null, "Published English"));
  const work: CatWork = { id: base, title: plainText(doc.title), lang: "grc", texts };
  return { work, author: { id: base, name: plainText(doc.author), works: [work] } };
}

/** A field's light markup as plain text: italics unmarked, ⟦added words⟧ kept between their brackets. */
function flat(ns: RichNode[]): string {
  return ns.map((n) => (n.k === "text" ? n.s : n.k === "br" ? " " : n.k === "added" ? `⟦${flat(n.c)}⟧` : flat(n.c))).join("");
}
const tidy = (ns: RichNode[]) => flat(ns).replace(/\s+/g, " ").trim();
/** A field as the reader's blocks: a paragraph each, or, where a paragraph is broken into lines (verse), a line each. */
function paragraphs(src: string | undefined): Block[] {
  const out: Block[] = [];
  parseRich(src).forEach((p, pi) => {
    const lines: RichNode[][] = [[]];
    for (const n of p) { if (n.k === "br") lines.push([]); else lines[lines.length - 1].push(n); }
    if (lines.length === 1) { out.push({ t: "p", c: [tidy(p)] }); return; }
    lines.map(tidy).filter(Boolean).forEach((l, li) => out.push({ t: "l", c: [l], ...(pi > 0 && li === 0 ? { para: true } : {}) }));
  });
  return out;
}

/** "3. The cause of the fevers", cut short for the page menu. */
function chunkLabel(heading: string | undefined, locator: string | undefined, n: number) {
  const name = plainText(heading ?? locator ?? "");
  const short = name.length > 60 ? `${name.slice(0, 58).replace(/\s+\S*$/, "")}…` : name;
  return short ? `${n}. ${short}` : `Passage ${n}`;
}

/**
 * The document as the reader's parsed texts: the Greek, one passage per row, a page per passage, and the chosen English
 * lined up beside it (a passage's heading stands at the top of its English). A row with no English stands untranslated.
 */
export function mineParsed(doc: TranslationDoc, version: MineVersion | null): Parsed {
  const units: Unit[] = [], trUnits: Unit[] = [], chunks: TeiDoc["chunks"] = [];
  const cite = citation(doc);
  doc.passages.forEach((p, pi) => {
    const first = units.length;
    p.rows.forEach((r, ri) => {
      const ref = cite.ref(pi, ri);
      const blocks = paragraphs(r.greek);
      if (!blocks.length) blocks.push({ t: "p", c: [""] });
      // the row's own name in the source (a page, a Bekker line), unless repeated from the row before or already its reference
      const name = r.label ?? (cite.own || (ri > 0 && p.rows[ri - 1].ref === r.ref) ? undefined : r.ref);
      if (name) blocks[0].c.unshift({ m: "section", n: name });
      units.push({ ref, blocks });

      const english = version === "published" ? r.published : version === "ours" ? r.english : undefined;
      const tr = paragraphs(english);
      if (tr.length) {
        if (ri === 0 && p.heading) tr.unshift({ t: "head", c: [plainText(p.heading)] });
        trUnits.push({ ref, blocks: tr });
      }
    });
    chunks.push({ label: chunkLabel(p.heading, p.locator, pi + 1), first, last: units.length - 1 });
  });
  const grc: TeiDoc = { lang: "grc", levels: cite.levels, units, chunks };
  if (!version) return { doc: grc, placed: null, trLevels: null };
  const tr: TeiDoc = { lang: "eng", levels: cite.levels, units: trUnits, chunks: [] };
  return { doc: grc, placed: placePieces(grc, translationPieces(grc, tr)), trLevels: cite.levels };
}
