/**
 * The narrator on the page: a passage's English read off the page as one string, and a stretch of that string found again as a
 * range of the page's text, to mark the sentence and the word being said. The marks are CSS highlights (globals.css,
 * ::highlight(voice-sentence) and ::highlight(voice-word)), which change nothing in the page's own elements; a browser without them
 * still marks the passage being read (data-voice on its row).
 */

/** What the voice leaves out: Greek quoted in the English, section markers, notes and gaps (data-silent, Blocks.tsx), and buttons. */
const SILENT = "[data-silent], [lang='grc'], sup, button, script, style, [aria-hidden='true']";
/** Elements that end a sentence where they end: a paragraph, a heading, a speaker's name. A line of verse does not. */
const BREAKS = "p, h1, h2, h3, h4, li, blockquote, [data-speaker]";

/** A passage's English as one string, and which text node of the page each part of it comes from. */
export interface Flat {
  root: Element;
  text: string;
  runs: { start: number; node: Text }[];
}

export function flatten(root: Element): Flat {
  let text = "";
  const runs: Flat["runs"] = [];
  const space = (s: string) => { if (text && !/\s$/.test(text)) text += s; else if (s === "\n" && text.endsWith(" ")) text = `${text.slice(0, -1)}\n`; };
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      if (t.data) { runs.push({ start: text.length, node: t }); text += t.data; }
      return;
    }
    if (!(n instanceof Element)) return;
    if (n !== root && n.matches(SILENT)) { space(" "); return; }
    const block = n !== root && n.matches(BREAKS);
    const div = n !== root && n.tagName === "DIV";
    if (block) space("\n"); else if (div) space(" ");
    for (const c of n.childNodes) walk(c);
    if (block) space("\n"); else if (div) space(" ");
  };
  walk(root);
  return { root, text, runs };
}

/** The run holding offset `k`, by halving. */
function runAt(f: Flat, k: number): number {
  let lo = 0, hi = f.runs.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (f.runs[mid].start <= k) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

/** The page's text from offset `s` to `e` of the flat string, as a Range; null if the page has changed since. */
export function rangeOf(f: Flat, s: number, e: number): Range | null {
  if (!f.root.isConnected || !f.runs.length || e <= s) return null;
  // the start: inside its run, or (in a space the flattening added) at the start of the next run
  let a = runAt(f, s);
  if (a < 0 || s >= f.runs[a].start + f.runs[a].node.data.length) a++;
  if (a >= f.runs.length) return null;
  const ra = f.runs[a];
  const startOff = Math.max(0, s - ra.start);
  // the end: inside its run, or at the end of the run before
  const b = runAt(f, e - 1);
  if (b < a) return null;
  const rb = f.runs[b];
  const endOff = Math.min(rb.node.data.length, e - rb.start);
  if (!ra.node.isConnected || !rb.node.isConnected) return null;
  const r = document.createRange();
  r.setStart(ra.node, startOff);
  r.setEnd(rb.node, endOff);
  return r;
}

/** The flat string's offset for a point in the page (where a click fell); -1 if the point is not in this passage's English. */
export function offsetOf(f: Flat, node: Node, offset: number): number {
  const run = f.runs.find((r) => r.node === node);
  if (run) return run.start + offset;
  // a point between elements: the first run after it
  for (const r of f.runs) {
    const pos = node.compareDocumentPosition(r.node);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING || pos & Node.DOCUMENT_POSITION_CONTAINED_BY) return r.start;
  }
  return -1;
}

/** The caret under a point of the window (where a click fell). */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

const canMark = () => typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

/** Mark the sentence and the word being said (either may be null: nothing marked). */
export function mark(sentence: Range | null, word: Range | null) {
  if (!canMark()) return;
  if (sentence) CSS.highlights.set("voice-sentence", new Highlight(sentence)); else CSS.highlights.delete("voice-sentence");
  if (word) {
    const h = new Highlight(word);
    h.priority = 1;
    CSS.highlights.set("voice-word", h);
  } else CSS.highlights.delete("voice-word");
}
export const unmark = () => mark(null, null);

/** The passage being read, marked in its row (Reader.module.css, .row[data-voice]); "" for none. */
export function markPassage(key: string) {
  for (const el of document.querySelectorAll("[data-voice]")) if (el.id !== `p-${key}`) el.removeAttribute("data-voice");
  if (key) document.getElementById(`p-${key}`)?.setAttribute("data-voice", "");
}
