/**
 * Lines up a translation beside the Greek, passage by passage.
 *
 * Every piece of translation gets an "anchor": the Greek reference it starts at.
 * - Same citation scheme (Plato's sections, a play's lines): the anchor is the piece's own reference.
 * - Coarser scheme (Murray's Iliad is cited by book and "card", but marks line numbers inside):
 *   pieces are cut at those inner line markers, and each piece is anchored at its line.
 * A row then holds the Greek from one anchor up to the next, with the translation that starts there.
 * The translation's words are never changed; only where it is cut into pieces.
 */
import type { Block, Inline, TeiDoc, Unit } from "./types";

export interface Row {
  key: string;            // anchor reference, e.g. "1.33"
  greek: Unit[];
  trans: Block[];         // empty when the translation has nothing for this stretch
  /** no English here because the English beside it began on the page before (and runs on into these lines) */
  cont?: boolean;
  /** holds English that this Greek edition has no place for (an appendix, a chapter the edition lacks) */
  extra?: boolean;
}

interface Piece { key: string | null; blocks: Block[]; src: number }   // src: the translation unit it comes from

const keyOf = (ref: string[]) => ref.join(".");

/** Cut a translation unit at markers naming the Greek's finest level (e.g. unit="line"). */
function splitAtMarkers(u: Unit, marker: string, prefix: string[], src: number): Piece[] {
  const pieces: Piece[] = [{ key: null, blocks: [], src }];
  for (const b of u.blocks) {
    let cur: Block = { ...b, c: [] } as Block;
    pieces[pieces.length - 1].blocks.push(cur);
    for (const x of b.c) {
      if (typeof x !== "string" && "m" in x && x.m === marker && x.n) {
        const piece: Piece = { key: keyOf([...prefix, x.n]), blocks: [], src };
        pieces.push(piece);
        // the block continues in the new piece: same kind of block, no repeated speaker label
        cur = { ...b, c: [], ...("speaker" in b ? { speaker: undefined } : {}) } as Block;
        piece.blocks.push(cur);
        continue;
      }
      cur.c.push(x as Inline);
    }
  }
  for (const p of pieces) p.blocks = p.blocks.filter((b) => b.c.some((x) => typeof x !== "string" || x.trim()));
  return pieces.filter((p) => p.blocks.length);
}

const textOf = (b: Block) => b.c.map((x) => (typeof x === "string" ? x : "")).join("");
/** where a sentence or clause ends: a full stop, colon, semicolon, question or exclamation mark, or a dash (and any closing quote) */
const CLAUSE_END = /[.;:!?·](?:["'”’)\]]*)(?=\s|$)|—/;

/**
 * Prose English cut at the Greek's line numbers often stops mid-sentence ("…to bring news from Troy and" beside lines 5–9,
 * "tidings of its capture. For thus…" beside line 10). Where a piece of prose ends inside a sentence, the next piece's words
 * up to the end of that sentence or clause move back to finish it, so the English breaks only where a sentence or clause
 * ends (review fix list, slice 8). Verse (short lines) is left as it is, and so is a cut where a new speaker begins.
 */
export function mendBreaks(pieces: Piece[]): Piece[] {
  const out = pieces.map((p) => ({ ...p, blocks: [...p.blocks] }));
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1];
    const last = a.blocks[a.blocks.length - 1], first = b.blocks[0];
    if (!last || !first || last.t === "head" || first.t === "head" || ("speaker" in first && first.speaker)) continue;
    const tail = textOf(last).trimEnd();
    if (tail.length < 100 || !/[\p{L}\p{N}]$/u.test(tail)) continue;
    // the end of the sentence, in the next piece's first block, not too far in
    let j = -1, cut = -1, chars = 0;
    for (let k = 0; k < first.c.length && chars < 400; k++) {
      const x = first.c[k];
      if (typeof x !== "string") continue;
      const m = CLAUSE_END.exec(x);
      if (m) { j = k; cut = m.index + m[0].length; break; }
      chars += x.length;
    }
    if (j < 0) continue;
    const s = first.c[j] as string;
    const moved: Inline[] = [...first.c.slice(0, j), s.slice(0, cut)];
    const rest: Inline[] = [s.slice(cut).replace(/^\s+/, ""), ...first.c.slice(j + 1)].filter((x) => typeof x !== "string" || x);
    a.blocks[a.blocks.length - 1] = { ...last, c: [...last.c, /\s$/.test(textOf(last)) ? "" : " ", ...moved].filter((x) => x !== "") } as Block;
    const left = rest.some((x) => typeof x !== "string" || x.trim());
    b.blocks = left ? [{ ...first, c: rest } as Block, ...b.blocks.slice(1)] : b.blocks.slice(1);
    if (!b.blocks.length) { out.splice(i + 1, 1); i--; }   // all of it finished the sentence: its lines join the piece before
  }
  return out;
}

/** Break the whole translation into anchored pieces, in reading order. A second Greek edition, compared line for line, is not mended. */
export function translationPieces(grc: TeiDoc, tr: TeiDoc): Piece[] {
  const pieces = rawPieces(grc, tr);
  return tr.lang?.startsWith("grc") ? pieces : mendBreaks(pieces);
}

function rawPieces(grc: TeiDoc, tr: TeiDoc): Piece[] {
  const gl = grc.levels, tl = tr.levels;
  let common = 0;
  while (common < Math.min(gl.length, tl.length) && gl[common] === tl[common]) common++;
  if (common === 0 && gl.length === tl.length) common = gl.length;   // differently named, same shape
  const sameScheme = common === gl.length && tl.length === gl.length;
  const leaf = gl[gl.length - 1];

  const finer = common === gl.length && tl.length > gl.length;   // e.g. English book.section.subsection, Greek book.section
  const pieces: Piece[] = [];
  tr.units.forEach((u, src) => {
    if (sameScheme) { pieces.push({ key: keyOf(u.ref), blocks: u.blocks, src }); return; }
    // a finer translation sits beside the Greek passage that contains it
    if (finer) { pieces.push({ key: keyOf(u.ref.slice(0, gl.length)), blocks: u.blocks, src }); return; }
    const prefix = u.ref.slice(0, Math.min(common, gl.length - 1));
    const parts = splitAtMarkers(u, leaf, prefix, src);
    // A coarser translation with no inner markers (English "chapter 5" against Greek 5.1, 5.2…)
    // starts at the first Greek passage of the division with the same number.
    if (tl.length < gl.length && parts.length === 1 && parts[0].key === null) {
      pieces.push({ key: keyOf([...u.ref, "?"]), blocks: parts[0].blocks, src });
      return;
    }
    // text before the first marker continues the previous piece, unless the unit starts a new division
    for (const p of parts) {
      if (p.key === null) {
        const prev = pieces[pieces.length - 1];
        if (prev && prev.key?.startsWith(keyOf(prefix) + ".")) prev.blocks.push(...p.blocks);
        else pieces.push({ key: prefix.length ? keyOf([...prefix, "?"]) : null, blocks: p.blocks, src });
      } else pieces.push(p);
    }
  });
  return pieces;
}

/** src: translation unit index; extra: the Greek edition has no passage or division for it (an appendix, a chapter it lacks) */
export interface Placed { at: number; blocks: Block[]; src: number; extra?: boolean }

/** e.g. Euclid's English "10.def_1.1" for the Greek "10.def1.1" */
const loose = (k: string) => k.toLowerCase().replace(/[_\s-]/g, "");

/**
 * Decide which Greek unit each translation piece starts at, for the whole text at once.
 * A piece whose reference the Greek doesn't have (a paragraph numbered differently, say) goes to the start of
 * its own division in the Greek, or follows the piece before it, so no translation is ever dropped. Where a
 * division's numbering does not correspond at all (Hippocrates' Epidemics: English 1.3.1–10 against Greek
 * 1.3.13–26), its pieces are spread through the Greek division in order, first with first and last with last.
 */
export function placePieces(grc: TeiDoc, pieces: Piece[]): Placed[] {
  const index = new Map<string, number>(), loosely = new Map<string, number>();
  const firstIn = new Map<string, number>(), unitsIn = new Map<string, number[]>();
  grc.units.forEach((u, i) => {
    const k = keyOf(u.ref);
    if (!index.has(k)) index.set(k, i);
    if (!loosely.has(loose(k))) loosely.set(loose(k), i);
    for (let d = 1; d < u.ref.length; d++) {
      const p = keyOf(u.ref.slice(0, d));
      if (!firstIn.has(p)) firstIn.set(p, i);
      if (d === u.ref.length - 1) { if (!unitsIn.has(p)) unitsIn.set(p, []); unitsIn.get(p)!.push(i); }
    }
  });
  const exact = (k: string | null) => (k == null ? undefined : index.get(k) ?? loosely.get(loose(k)));
  const parentOf = (k: string) => k.slice(0, Math.max(0, k.lastIndexOf(".")));

  // divisions whose pieces mostly match nothing in the Greek: spread them through the division in order
  const spread = new Map<Piece, number>();
  const groups = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (!p.key || p.key.endsWith("?") || !p.key.includes(".")) continue;
    const par = parentOf(p.key);
    if (!unitsIn.has(par)) continue;
    if (!groups.has(par)) groups.set(par, []);
    groups.get(par)!.push(p);
  }
  for (const [par, ps] of groups) {
    const g = unitsIn.get(par)!;
    if (g.length < 2) continue;
    const share = ps.filter((p) => exact(p.key) !== undefined).length / ps.length;
    // numbered from a different start (English 1.2.1–6 against Greek 1.2.4–12): matching numbers are coincidence
    const leaf = (k: string) => k.slice(k.lastIndexOf(".") + 1);
    const eFirst = leaf(ps[0].key!), gFirst = leaf(keyOf(grc.units[g[0]].ref));
    const coincidence = share < 0.8 && /^\d+$/.test(eFirst) && /^\d+$/.test(gFirst) && eFirst !== gFirst;
    if (!coincidence && share >= 0.5) continue;
    ps.forEach((p, i) => { if (coincidence || exact(p.key) === undefined) spread.set(p, g[ps.length < 2 ? 0 : Math.round((i * (g.length - 1)) / (ps.length - 1))]); });
  }

  const placed: Placed[] = [];
  let prev = 0;
  for (const p of pieces) {
    let at = spread.get(p) ?? exact(p.key);
    let extra = false;
    if (at === undefined && p.key?.endsWith(".?")) {
      const pre = p.key.slice(0, -1);
      const j = grc.units.findIndex((u) => keyOf(u.ref).startsWith(pre));
      if (j >= 0) at = j;
    }
    if (at === undefined && p.key) {
      // the start of the nearest division the Greek has
      let k = parentOf(p.key.replace(/\.\?$/, ""));
      while (k && !firstIn.has(k)) k = parentOf(k);
      if (k) at = firstIn.get(k);
      else extra = grc.units.length > 1 && (!p.key.endsWith("?") || !grc.units.some((u) => keyOf(u.ref).startsWith(p.key!.slice(0, -1))));
    }
    if (at === undefined) at = prev;
    // never let a piece jump backwards past the one before it
    if (at < prev && placed.length) at = prev;
    placed.push({ at, blocks: p.blocks, src: p.src, ...(extra ? { extra: true } : {}) });
    prev = at;
  }
  return placed;
}

/**
 * Rows for one chunk (page) of the Greek. A stretch of English runs on beside the Greek until the next anchor,
 * but never out of the division (book, chapter) it started in: Greek beyond it that no English is anchored in
 * is a row of its own with no translation, which the reader marks as not translated.
 */
export function alignChunk(grc: TeiDoc, chunk: { first: number; last: number }, placed: Placed[] | null): Row[] {
  const starts = new Map<number, Block[]>(), extra = new Set<number>();
  let before = -1;                                     // where the last English before this page was anchored
  for (const p of placed ?? []) {
    if (p.at < chunk.first) { before = Math.max(before, p.at); continue; }
    if (p.at > chunk.last) continue;
    if (!starts.has(p.at)) starts.set(p.at, []);
    starts.get(p.at)!.push(...p.blocks);
    if (p.extra) extra.add(p.at);
  }
  const division = (i: number) => keyOf(grc.units[i].ref.slice(0, -1));
  const rows: Row[] = [];
  let scope: string | null = null;                     // the division the current row's English belongs to
  for (let i = chunk.first; i <= chunk.last; i++) {
    const u = grc.units[i];
    if (starts.has(i)) {
      rows.push({ key: keyOf(u.ref), greek: [u], trans: starts.get(i)!, ...(extra.has(i) ? { extra: true } : {}) });
      scope = division(i);
    } else if (i === chunk.first) {
      const cont = !!placed && before >= 0 && division(before) === division(i);
      rows.push({ key: keyOf(u.ref), greek: [u], trans: [], ...(cont ? { cont: true } : {}) });
      scope = cont ? division(i) : null;
    } else if (placed && scope !== null && division(i) !== scope) {
      rows.push({ key: keyOf(u.ref), greek: [u], trans: [] });
      scope = null;
    } else rows[rows.length - 1].greek.push(u);
  }
  return rows;
}

/** Share of Greek rows in this chunk that have translation beside them (0–1). */
export const coverage = (rows: Row[]) => rows.length ? rows.filter((r) => r.trans.length).length / rows.length : 0;
/** Rows the translation leaves out: no English, and not English running on from the page before. */
export const untranslated = (rows: Row[]) => rows.filter((r) => !r.trans.length && !r.cont);
