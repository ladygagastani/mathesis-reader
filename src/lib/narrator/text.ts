/**
 * The narrator's text: a passage's English cut into what the voice says in one go, and each piece made fit to be spoken.
 * The voice reads the English only. Greek quoted inside it, the section markers and the notes never reach this text (lib/narrator/dom.ts
 * leaves them out). Everything here is plain string work, so it is tested without a browser.
 */

/** A stretch of a passage's English said in one go: a sentence, or a clause of a long one. Offsets are into the passage's text. */
export interface Segment {
  start: number;
  end: number;
  /** the whole sentence it belongs to (the same as start and end unless a long sentence was cut) */
  sentence: [number, number];
}

/** A name the voice gets wrong, and how to say it instead. */
export interface SayAs { write: string; say: string }

/** Longer than this, a sentence is cut at a clause. Chrome's network voices stop after about 15 seconds of one utterance. */
export const MAX_SEGMENT = 200;

const HAS_WORD = /[\p{L}\p{N}]/u;

/** The sentences of `text`, as [start, end) offsets, trimmed of space at either end. Sentences with no letter or figure are left out. */
export function sentences(text: string): [number, number][] {
  const out: [number, number][] = [];
  const push = (s: number, e: number) => {
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s && HAS_WORD.test(text.slice(s, e))) out.push([s, e]);
  };
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("en", { granularity: "sentence" });
    for (const s of seg.segment(text)) {
      // a line break inside a segment also ends a sentence (a speaker's name, a heading)
      let at = s.index;
      for (const part of s.segment.split("\n")) { push(at, at + part.length); at += part.length + 1; }
    }
  } else {
    const re = /[^.!?\n]+(?:[.!?]+["'”’)\]]*|\n|$)/g;
    for (let m = re.exec(text); m; m = re.exec(text)) { push(m.index, m.index + m[0].length); if (!m[0]) re.lastIndex++; }
  }
  return mergeShort(text, out);
}

/** A "sentence" of one or two letters ("i.", "B.") is an abbreviation cut off from its sentence: it joins the sentence after it. */
function mergeShort(text: string, list: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < list.length; i++) {
    const [s, e] = list[i];
    const letters = text.slice(s, e).replace(/[^\p{L}\p{N}]/gu, "");
    const next = list[i + 1];
    if (letters.length <= 2 && next && !text.slice(e, next[0]).includes("\n")) { list[i + 1] = [s, next[1]]; continue; }
    out.push([s, e]);
  }
  return out;
}

/** Where a long stretch may be cut: after a semicolon, a colon or a dash first, then after a comma. */
const STRONG = /[;:—–](?:["'”’)\]]*)\s/g;
const WEAK = /,(?:["'”’)\]]*)\s/g;

function cut(text: string, s: number, e: number, max: number): [number, number][] {
  if (e - s <= max) return [[s, e]];
  const piece = text.slice(s, e);
  const best = (re: RegExp) => {
    let at = -1;
    re.lastIndex = 0;
    for (let m = re.exec(piece); m; m = re.exec(piece)) {
      const end = m.index + m[0].length;
      if (end > max) break;
      if (end >= 40) at = end;
    }
    return at;
  };
  let at = best(STRONG);
  if (at < 0) at = best(WEAK);
  if (at < 0) {
    // no clause: the last space before the limit
    at = piece.lastIndexOf(" ", max);
    if (at < 40) at = piece.indexOf(" ", max);
    if (at < 0) return [[s, e]];
  }
  let head = s + at;
  while (head > s && /\s/.test(text[head - 1])) head--;
  let tail = s + at;
  while (tail < e && /\s/.test(text[tail])) tail++;
  return [[s, head], ...cut(text, tail, e, max)];
}

/** The passage's English as the voice will say it: its sentences, the long ones cut at their clauses. */
export function segments(text: string, max = MAX_SEGMENT): Segment[] {
  return sentences(text).flatMap(([s, e]) => cut(text, s, e, max).map(([a, b]): Segment => ({ start: a, end: b, sentence: [s, e] })));
}

/** Abbreviations a voice reads badly, said in words. */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bcf\./gi, "compare"],
  [/\bi\.\s?e\./gi, "that is"],
  [/\be\.\s?g\./gi, "for example"],
  [/\bviz\./gi, "namely"],
  [/&c\./g, "et cetera"],
  [/\betc\./gi, "et cetera"],
  [/&/g, "and"],
];
/** Signs an editor adds that a voice would read out or stumble on: brackets, daggers, asterisks. Their words stay. */
const SIGNS = /[[\]⟨⟩<>{}†‡*¶§]/g;

/**
 * `text` made fit to say: the reader's own pronunciations first, then the abbreviations, then the editor's signs gone and the spaces
 * made single. `from[k]` and `to[k]` give, for each letter of what is said, the stretch of `text` it stands for, so a word the voice
 * reports can be found again in the passage.
 */
export function speakable(text: string, say: SayAs[] = []): { spoken: string; from: number[]; to: number[] } {
  const edits: { s: number; e: number; r: string }[] = [];
  const free = (s: number, e: number) => edits.every((x) => e <= x.s || s >= x.e);
  const add = (re: RegExp, r: string | ((m: string) => string)) => {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (!m[0]) { re.lastIndex++; continue; }
      const s = m.index, e = s + m[0].length;
      if (free(s, e)) edits.push({ s, e, r: typeof r === "string" ? r : r(m[0]) });
    }
  };
  for (const { write, say: as } of say) {
    const w = write.trim();
    if (!w) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // whole words only; a name written with capitals or without is the same name
    add(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu"), as.trim());
  }
  for (const [re, r] of ABBREVIATIONS) add(re, r);
  add(SIGNS, "");
  add(/\s+/g, " ");
  edits.sort((a, b) => a.s - b.s);

  let spoken = "";
  const from: number[] = [], to: number[] = [];
  let i = 0;
  const keep = (upto: number) => { for (; i < upto; i++) { spoken += text[i]; from.push(i); to.push(i + 1); } };
  for (const x of edits) {
    keep(x.s);
    for (const ch of x.r) { spoken += ch; from.push(x.s); to.push(x.e); }
    i = x.e;
  }
  keep(text.length);
  // no space at either end
  let a = 0, b = spoken.length;
  while (a < b && spoken[a] === " ") a++;
  while (b > a && spoken[b - 1] === " ") b--;
  return { spoken: spoken.slice(a, b), from: from.slice(a, b), to: to.slice(a, b) };
}

/** The word of `spoken` that begins at `i` (as the voice reports it), as a stretch of the original text; null if there is none. */
export function wordAt(spoken: string, from: number[], to: number[], i: number, len = 0): [number, number] | null {
  if (i < 0 || i >= spoken.length) return null;
  let end = len > 0 ? Math.min(spoken.length, i + len) : i;
  if (len <= 0) {
    const m = /^[\p{L}\p{N}’'-]+/u.exec(spoken.slice(i));
    end = i + (m ? m[0].length : 1);
  }
  return [from[i], to[end - 1]];
}

/** Words in a stretch of English. */
export const wordCount = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) ?? []).length;

/** A voice at its usual speed says about this many words of English a minute. */
export const WORDS_A_MINUTE = 165;

/** Minutes to say `words` at `rate` (1 is the voice's own speed), rounded up. */
export const minutesFor = (words: number, rate: number) => Math.ceil(words / (WORDS_A_MINUTE * rate));

/** "under a minute", "1 minute", "12 minutes", "1 hour 5 minutes" */
export function duration(minutes: number): string {
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h} ${h === 1 ? "hour" : "hours"}${m ? ` ${m} ${m === 1 ? "minute" : "minutes"}` : ""}`;
}
