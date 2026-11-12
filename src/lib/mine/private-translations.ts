/**
 * The site's own translations (Aristotle, Galen…), which only the moderator may read. Their text lives
 * only in the database (table private_translations, supabase/migrations/20261013120000_private_translations.sql),
 * never in this repository or the built site: the repository is public. This file holds only what is safe to
 * publish: the shape of a translation file, the check run on a file before it is saved, the light markup of its
 * text fields, and links into the site's own reader. (Lifted from the old app's lib/private-translations.ts; its admin page is not part of this app.)
 *
 * Nothing here touches the database or the browser's storage, so it is tested on its own
 * (private-translations.test.ts, with made-up placeholder text only).
 */

export const FORMAT = "mathesis-translation/1";
/** "imported": a text brought in from the reader's "Import a text" (lib/import-text.ts), not one of our translations. */
export const STATUSES = ["sample", "draft", "complete", "imported"] as const;
export type Status = (typeof STATUSES)[number];
/** The same rule as the database's check on private_translations.id. */
export const ID_PATTERN = /^[a-z0-9-]{1,80}$/;

/** One reference: the Greek, our English and, optionally, the published English, side by side. */
export interface TranslationRow {
  /** the site's reference, used for the link into the reader ("1.7"); several rows may share one */
  ref?: string;
  /** shown in the margin instead of `ref`, e.g. a Bekker line ("1097a15") inside a chapter the reader cites whole */
  label?: string;
  greek: string;
  /** required in a translation; an imported text may leave it out (a Greek text read on its own) */
  english?: string;
  published?: string;
}
/** A place where our English parts from the published translation, and why. */
export interface Difference { greek?: string; published?: string; ours?: string; why?: string }
export interface Passage {
  heading?: string;
  locator?: string;
  rows: TranslationRow[];
  notes?: string[];
  differences?: Difference[];
}
export interface TranslationDoc {
  format: typeof FORMAT;
  id: string;
  author: string;
  title: string;
  greekTitle?: string;
  status: Status;
  updated?: string;
  urn?: string;
  greekEdition?: string;
  publishedTranslation?: string;
  intro?: string;
  passages: Passage[];
}

/**
 * The result of checking a file: the translation as the page shows it (known fields only, empty optional
 * text dropped) and the file's own object (saved as it is, so a download gives back everything it held);
 * or the problems, in plain English, each saying where it is.
 */
export type Checked =
  | { ok: true; doc: TranslationDoc; raw: Record<string, unknown>; warnings: string[] }
  | { ok: false; problems: string[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** What was found instead, in words. */
function what(x: unknown): string {
  if (x === null) return "nothing (null)";
  if (Array.isArray(x)) return "a list in [ square brackets ]";
  if (typeof x === "number") return `the number ${x}`;
  if (typeof x === "boolean") return `the word ${x}`;
  if (typeof x === "object") return "a group of fields in { curly brackets }";
  if (typeof x === "string") return `"${x.length > 40 ? `${x.slice(0, 40)}…` : x}"`;
  return typeof x;
}

/** Plain names for the fields, with the field's own name in brackets so whoever wrote the file can find it. */
const NAMES: Record<string, string> = {
  format: "the format", id: "the id", author: "the author", title: "the title", greekTitle: "the Greek title", status: "the status",
  updated: "the date", urn: "the urn", greekEdition: "the Greek edition", publishedTranslation: "the published translation",
  intro: "the introduction", passages: "the passages", heading: "the heading", locator: "the locator", rows: "the rows",
  notes: "the notes", differences: "the differences", ref: "the reference", label: "the label", greek: "the Greek",
  english: "our English", published: "the published English", ours: "our wording", why: "the reason",
};
const named = (key: string) => `${NAMES[key] ?? "the field"} ("${key}")`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "The title ("title")" at the top level, "Passage 2, row 3: the Greek ("greek")" further in. */
const subject = (where: string, key: string) => (where ? `${where}: ${named(key)}` : cap(named(key)));

class Collector {
  problems: string[] = [];
  /** A text field: required ones must be there and not empty; optional ones may be left out. Empty optional text counts as absent. */
  text(o: Record<string, unknown>, key: string, where: string, required: boolean): string | undefined {
    const v = o[key];
    if (v === undefined || v === null) {
      if (required) this.problems.push(`${subject(where, key)} is missing.`);
      return undefined;
    }
    if (typeof v !== "string") {
      this.problems.push(`${subject(where, key)} must be text in "quotation marks" (found ${what(v)}).`);
      return undefined;
    }
    if (!v.trim()) {
      if (required) this.problems.push(`${subject(where, key)} is empty.`);
      return undefined;
    }
    return v;
  }
  /** A list field: undefined when left out (or wrong, with a problem noted). */
  list(o: Record<string, unknown>, key: string, where: string): unknown[] | undefined {
    const v = o[key];
    if (v === undefined || v === null) return undefined;
    if (!Array.isArray(v)) { this.problems.push(`${subject(where, key)} must be a list in [ square brackets ] (found ${what(v)}).`); return undefined; }
    return v;
  }
}

/** Where a row is, for a problem: "Passage 2, row 3 (4.2)". */
function rowPlace(p: number, r: number, row: unknown): string {
  const name = isObj(row) ? [row.label, row.ref].find((x) => typeof x === "string" && x.trim()) as string | undefined : undefined;
  return `Passage ${p}, row ${r}${name ? ` (${name.trim()})` : ""}`;
}

/** The work's id in the reader ("tlg0086.tlg034") and the Greek edition, if the urn names one. */
export function workOf(urn: string | undefined): { work: string; ed: string | null } | null {
  const m = /^urn:cts:[a-zA-Z]+:([a-z0-9]+\.[a-z0-9]+)(?:\.([a-z0-9-]+))?$/.exec((urn ?? "").trim());
  return m ? { work: m[1], ed: m[2] ?? null } : null;
}

/** A date written year-month-day ("2026-10-13"). */
export const isIsoDate = (s: string | undefined | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

/** Check a translation as read from its file. Unknown extra fields are allowed and left alone. */
export function checkTranslation(input: unknown): Checked {
  if (!isObj(input)) {
    return { ok: false, problems: [`This file does not hold a translation: it should be one group of fields in { curly brackets }, but it holds ${what(input)}.`] };
  }
  const c = new Collector();
  const warnings: string[] = [];

  if (input.format === undefined) c.problems.push(`The format ("format") is missing: the file should say "format": "${FORMAT}", so the page knows how to read it.`);
  else if (input.format !== FORMAT) c.problems.push(`The format ("format") is ${what(input.format)}, but this page reads only "${FORMAT}".`);

  const id = c.text(input, "id", "", true);
  if (id !== undefined && !ID_PATTERN.test(id)) {
    c.problems.push(id.length > 80
      ? `The id ("id") is ${id.length} characters long; it may be at most 80.`
      : `The id ("id") may use only lowercase letters, digits and hyphens, like "aristotle-poetics"; ${what(id)} has other characters.`);
  }
  const author = c.text(input, "author", "", true);
  const title = c.text(input, "title", "", true);
  let status: Status | undefined;
  if (input.status === undefined || input.status === null) c.problems.push(`The status ("status") is missing: it should be "sample", "draft", "complete" or "imported".`);
  else if (typeof input.status === "string" && (STATUSES as readonly string[]).includes(input.status)) status = input.status as Status;
  else c.problems.push(`The status ("status") must be "sample", "draft", "complete" or "imported" (found ${what(input.status)}).`);

  const opt: Partial<TranslationDoc> = {};
  for (const k of ["greekTitle", "updated", "urn", "greekEdition", "publishedTranslation", "intro"] as const) {
    const v = c.text(input, k, "", false);
    if (v !== undefined) opt[k] = v;
  }
  if (opt.urn !== undefined && !workOf(opt.urn)) {
    warnings.push(`The urn ("urn") is not written like "urn:cts:greekLit:tlg0086.tlg034", so the rows will not link to the site's reader.`);
  }
  if (opt.updated !== undefined && !isIsoDate(opt.updated)) {
    warnings.push(`The date ("updated") is not written as year-month-day, like "2026-10-13"; it will be shown as it is.`);
  }

  const passages: Passage[] = [];
  const ps = input.passages;
  if (ps === undefined || ps === null) c.problems.push(`The passages ("passages") are missing: a translation needs at least one passage.`);
  else if (!Array.isArray(ps)) c.problems.push(`The passages ("passages") must be a list in [ square brackets ] (found ${what(ps)}).`);
  else if (!ps.length) c.problems.push(`The list of passages ("passages") is empty: a translation needs at least one passage.`);
  else ps.forEach((p, pi) => {
    const pw = `Passage ${pi + 1}`;
    if (!isObj(p)) { c.problems.push(`${pw} must be a group of fields in { curly brackets } (found ${what(p)}).`); return; }
    const passage: Passage = { rows: [] };
    const heading = c.text(p, "heading", pw, false), locator = c.text(p, "locator", pw, false);
    if (heading !== undefined) passage.heading = heading;
    if (locator !== undefined) passage.locator = locator;

    const rows = c.list(p, "rows", pw);
    if (!rows || !rows.length) {
      if (rows || p.rows === undefined || p.rows === null) c.problems.push(`${pw} has no rows ("rows"): each passage needs at least one row of Greek and English.`);
    } else rows.forEach((r, ri) => {
      const rw = rowPlace(pi + 1, ri + 1, r);
      if (!isObj(r)) { c.problems.push(`${rw} must be a group of fields in { curly brackets } (found ${what(r)}).`); return; }
      const greek = c.text(r, "greek", rw, true), english = c.text(r, "english", rw, status !== "imported");
      const ref = c.text(r, "ref", rw, false), label = c.text(r, "label", rw, false), published = c.text(r, "published", rw, false);
      if (greek === undefined || (english === undefined && status !== "imported")) return;
      const row: TranslationRow = { greek };
      if (english !== undefined) row.english = english;
      if (ref !== undefined) row.ref = ref.trim();
      if (label !== undefined) row.label = label.trim();
      if (published !== undefined) row.published = published;
      passage.rows.push(row);
    });

    const notes = c.list(p, "notes", pw);
    if (notes) {
      const kept: string[] = [];
      notes.forEach((n, ni) => {
        if (typeof n !== "string") c.problems.push(`${pw}, note ${ni + 1} must be text in "quotation marks" (found ${what(n)}).`);
        else if (n.trim()) kept.push(n);
      });
      if (kept.length) passage.notes = kept;
    }

    const diffs = c.list(p, "differences", pw);
    if (diffs) {
      const kept: Difference[] = [];
      diffs.forEach((d, di) => {
        const dw = `${pw}, difference ${di + 1}`;
        if (!isObj(d)) { c.problems.push(`${dw} must be a group of fields in { curly brackets } (found ${what(d)}).`); return; }
        const diff: Difference = {};
        for (const k of ["greek", "published", "ours", "why"] as const) {
          const v = c.text(d, k, dw, false);
          if (v !== undefined) diff[k] = v;
        }
        const wrong = ["greek", "published", "ours", "why"].some((k) => d[k] !== undefined && d[k] !== null && typeof d[k] !== "string");
        if (!Object.keys(diff).length && !wrong) c.problems.push(`${dw} is empty: it has none of "greek", "published", "ours" or "why".`);
        else kept.push(diff);
      });
      if (kept.length) passage.differences = kept;
    }
    passages.push(passage);
  });

  if (c.problems.length) return { ok: false, problems: c.problems };
  const doc: TranslationDoc = { format: FORMAT, id: id!, author: author!, title: title!, status: status!, ...opt, passages };
  return { ok: true, doc, raw: input, warnings };
}

/** Does any row carry the published English (so the page offers to show it)? */
export const hasPublished = (doc: TranslationDoc) => doc.passages.some((p) => p.rows.some((r) => r.published !== undefined));

// ------------------------------------------------------------ the light markup of the text fields
/**
 * Text in every field may carry three marks: a blank line starts a new paragraph (a single line break is
 * kept as one), *words* are set in italics, and ⟦words⟧ are words the editor of the Greek thinks were added
 * later. Anything else is text as written: no HTML is ever read from a file. A mark that is never closed
 * (a lone * or ⟦) stays as it is, so nothing typed is lost.
 */
export type RichNode =
  | { k: "text"; s: string }
  | { k: "i"; c: RichNode[] }
  | { k: "added"; c: RichNode[] }
  | { k: "br" };
export type RichPara = RichNode[];

const space = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
/** Is there a closing * after `from` (one that follows a letter, not a space)? */
function closes(s: string, from: number): boolean {
  for (let j = from + 1; j < s.length; j++) if (s[j] === "*" && !space(s[j - 1])) return true;
  return false;
}

function parseInline(s: string): RichNode[] {
  type Frame = { kind: "root" | "i" | "added"; c: RichNode[] };
  const stack: Frame[] = [{ kind: "root", c: [] }];
  const top = () => stack[stack.length - 1];
  let buf = "";
  const flush = () => { if (buf) { top().c.push({ k: "text", s: buf }); buf = ""; } };
  const close = () => {
    flush();
    const f = stack.pop()!;
    if (f.c.length) top().c.push({ k: f.kind as "i" | "added", c: f.c });
  };
  const open = (kind: "i" | "added") => { flush(); stack.push({ kind, c: [] }); };
  const inside = (kind: "i" | "added") => stack.some((f) => f.kind === kind);
  const closeTo = (kind: "i" | "added") => { while (top().kind !== kind) close(); close(); };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n") { flush(); top().c.push({ k: "br" }); continue; }
    if (ch === "⟦" && s.indexOf("⟧", i + 1) > i + 1) { open("added"); continue; }
    if (ch === "⟧" && inside("added")) { closeTo("added"); continue; }
    // two stars together are not a mark here (only *one* star makes italics): kept as written
    if (ch === "*" && s[i + 1] === "*") { buf += "**"; i++; continue; }
    if (ch === "*") {
      if (inside("i")) { if (!space(s[i - 1])) { closeTo("i"); continue; } }
      else if (!space(s[i + 1]) && closes(s, i + 1)) { open("i"); continue; }
    }
    buf += ch;
  }
  // a mark crossed by another and left open keeps its text, styled to the end of the paragraph
  while (stack.length > 1) close();
  flush();
  return stack[0].c;
}

/** A text field as paragraphs of marked-up pieces. */
export function parseRich(src: string | undefined | null): RichPara[] {
  if (!src) return [];
  return src.replace(/\r\n?/g, "\n").split(/\n(?:[ \t]*\n)+/)
    .map((p) => p.replace(/^\s+|\s+$/g, ""))
    .filter(Boolean)
    .map(parseInline);
}

/** The words of a text field without its marks, one space between words (for matching). */
export const plainText = (src: string | undefined | null) => (src ?? "").replace(/[⟦⟧*]/g, "").replace(/\s+/g, " ").trim().normalize("NFC");
