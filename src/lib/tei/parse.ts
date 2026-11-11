/**
 * TEI XML → citable passages.
 *
 * The file's own citation scheme (the CTS `cRefPattern` in its header) decides what a passage
 * is: a line of verse, a section of prose, a verse of the New Testament… When a file has no
 * pattern, nested numbered `div`s (and numbered lines inside them) are used instead.
 *
 * Nothing in the text is changed: every character of running text is kept, only whitespace
 * runs are collapsed, as any XML renderer does.
 */
import { SaxesParser } from "saxes";
import type { Block, Inline, TeiDoc, Unit } from "./types";

interface El { name: string; attrs: Record<string, string>; kids: (El | string)[] }
interface Step { name: string; desc: boolean; preds: [string, string][]; group: boolean }

const local = (n: string) => n.slice(n.indexOf(":") + 1);

// ------------------------------------------------------------------ 1. XML → small tree
function buildTree(xml: string): { body: El | null; patterns: { n: string; rp: string }[]; refStates: string[] } {
  const parser = new SaxesParser({ xmlns: false, position: false });
  const root: El = { name: "#root", attrs: {}, kids: [] };
  const stack: El[] = [root];
  const patterns: { n: string; rp: string }[] = [];
  const refStates: string[] = [];
  let skip = 0;          // depth inside <teiHeader>, which we don't keep
  let body: El | null = null;

  parser.on("error", () => { /* keep going: unknown entities etc. must not lose the text */ });
  parser.on("opentag", (t) => {
    const name = local(t.name);
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.attributes)) attrs[k] = String(v);
    if (skip) {
      skip++;
      if (name === "cRefPattern" && attrs.replacementPattern) patterns.push({ n: attrs.n ?? "", rp: attrs.replacementPattern });
      if (name === "refState" && attrs.unit) refStates.push(attrs.unit.toLowerCase());
      return;
    }
    if (name === "teiHeader") { skip = 1; return; }
    const el: El = { name, attrs, kids: [] };
    stack[stack.length - 1].kids.push(el);
    stack.push(el);
    if (name === "body" && !body) body = el;
  });
  parser.on("closetag", () => { if (skip) { skip--; return; } stack.pop(); });
  parser.on("text", (s) => { if (!skip && stack.length > 1) stack[stack.length - 1].kids.push(s); });
  parser.on("cdata", (s) => { if (!skip && stack.length > 1) stack[stack.length - 1].kids.push(s); });
  parser.write(xml).close();
  return { body, patterns, refStates };
}

// ------------------------------------------------------------------ 2. citation scheme
function parsePattern(rp: string): Step[] | null {
  // some headers escape the quotes, e.g. tei:l[@n=\'$1\']; the backslashes carry no meaning here
  const m = /#xpath\((.*)\)\s*$/.exec(rp.replace(/\\/g, "").trim());
  if (!m) return null;
  const steps: Step[] = [];
  for (const [, axis, raw] of m[1].matchAll(/(\/\/?)([^/[\]]+(?:\[[^\]]*\])*)/g)) {
    const name = local(raw.replace(/\[.*$/, ""));
    const preds: [string, string][] = [];
    let group = false;
    for (const [, attr, val] of raw.matchAll(/@([\w:]+)\s*=\s*['"]([^'"]*)['"]/g)) {
      if (/^\$\d+$/.test(val)) group = true; else preds.push([attr, val]);
    }
    steps.push({ name, desc: axis === "//", preds, group });
  }
  // drop /TEI/text/body; keep from the edition div down
  const i = steps.findIndex((s) => s.name === "body");
  return i >= 0 ? steps.slice(i + 1) : steps;
}

const isEl = (k: El | string): k is El => typeof k !== "string";
const textOf = (el: El): string => el.kids.map((k) => (isEl(k) ? (k.name === "reg" ? "" : textOf(k)) : k)).join("");

/** Fallback when the header has no pattern: nested numbered textpart divs, then numbered lines. */
function inferSteps(edition: El): { steps: Step[]; levels: string[] } {
  const steps: Step[] = [{ name: "div", desc: false, preds: [], group: false }];
  const levels: string[] = [];
  let cur = edition;
  for (;;) {
    const next = cur.kids.find((k): k is El => isEl(k) && k.name === "div" && "n" in k.attrs);
    if (!next) break;
    steps.push({ name: "div", desc: false, preds: [], group: true });
    levels.push((next.attrs.subtype || "part").toLowerCase());
    cur = next;
  }
  const hasLines = (e: El): boolean => e.kids.some((k) => isEl(k) && ((k.name === "l" && "n" in k.attrs) || hasLines(k)));
  if (hasLines(cur)) { steps.push({ name: "l", desc: true, preds: [], group: true }); levels.push("line"); }
  return { steps, levels };
}

function matches(el: El, s: Step): boolean {
  if (el.name !== s.name) return false;
  if (s.group && !("n" in el.attrs)) return false;
  return s.preds.every(([a, v]) => el.attrs[a] === v);
}
/** whether an element has a descendant matching the step */
const holds = (el: El, s: Step): boolean => el.kids.some((k) => isEl(k) && (matches(k, s) || holds(k, s)));

// ------------------------------------------------------------------ 3. content → blocks
class Emitter {
  units: Unit[] = [];
  private pending: Block[] = [];         // content met before the first passage
  private unit: Unit | null = null;
  private block: Block | null = null;
  private speaker: string | undefined;
  private carry: Inline[] = [];          // markers from a block that had no text of its own
  private parts: string[] = [];          // subtypes of the divisions we are inside (strophe, episode…)

  enterDiv(subtype: string | undefined) { this.parts.push((subtype ?? "").toLowerCase()); }
  leaveDiv() { this.parts.pop(); }

  private get blocks(): Block[] { return this.unit ? this.unit.blocks : this.pending; }

  startUnit(ref: string[]) {
    this.endBlock();
    this.unit = { ref, blocks: this.pending.length ? this.pending : [] };
    this.pending = [];
    this.units.push(this.unit);
  }
  /** Element passages end with their element; milestone passages run on until the next one. */
  endUnit() { this.endBlock(); this.unit = null; }

  setSpeaker(s: string) { this.endBlock(); this.speaker = s.replace(/\s+/g, " ").trim(); }

  startBlock(t: "p" | "l" | "head", n?: string) {
    this.endBlock();
    const b: Block = t === "l" ? { t, n, c: [] } : t === "p" ? { t, c: [] } : { t, c: [] };
    if (this.speaker && t !== "head") { (b as { speaker?: string }).speaker = this.speaker; this.speaker = undefined; }
    // the kind of passage a verse line sits in (Perseus marks strophe, antistrophe, lyric, episode…)
    if (t === "l") { const part = this.parts.findLast((x) => x); if (part) (b as { part?: string }).part = part; }
    if (this.carry.length) { b.c.push(...this.carry); this.carry = []; }
    this.block = b;
    this.blocks.push(b);
  }
  endBlock() {
    const b = this.block;
    if (b) {
      // trim the edges of the block, keep inner spacing
      const c = b.c;
      while (typeof c[0] === "string" && !(c[0] as string).trim()) c.shift();
      while (typeof c[c.length - 1] === "string" && !(c[c.length - 1] as string).trim()) c.pop();
      // trim the first and last runs of text, even when markers come before or after them
      const fi = c.findIndex((x) => typeof x === "string");
      if (fi >= 0) c[fi] = (c[fi] as string).replace(/^\s+/, "");
      const li = c.findLastIndex((x) => typeof x === "string");
      if (li >= 0) c[li] = (c[li] as string).replace(/\s+$/, "");
      if (b.t === "l" && c.length && typeof c[0] !== "string" && "m" in c[0] && c[0].m === "para") b.para = true;
      const hasText = c.some((x) => (typeof x === "string" && x.trim()) || (typeof x !== "string" && !("m" in x)));
      if (!hasText) {
        this.blocks.splice(this.blocks.indexOf(b), 1);
        this.carry.push(...c.filter((x) => typeof x !== "string"));
      }
    }
    this.block = null;
  }
  inline(x: Inline) {
    if (!this.block) {
      if (typeof x === "string" && !x.trim()) return;
      this.startBlock("p");
    }
    const c = this.block!.c;
    if (typeof x === "string") {
      const s = x.replace(/\s+/g, " ");
      const last = c[c.length - 1];
      if (typeof last === "string") {
        // where two pieces of text meet at a markup boundary, markup whitespace must not
        // double a space or push punctuation away from its word ("Halicarnassus ,")
        let prev = last, next = s;
        if (/\s$/.test(prev) && /^\s/.test(next)) next = next.replace(/^\s+/, "");
        if (/\s$/.test(prev) && /^[,.;:·!?)\]]/.test(next)) prev = prev.replace(/\s+$/, "");
        c[c.length - 1] = prev + next;
      } else c.push(s);
    } else c.push(x);
  }
  finish() {
    this.endBlock();
    if (this.carry.length && this.units.length) {
      const last = this.units[this.units.length - 1].blocks;
      if (last.length) last[last.length - 1].c.push(...this.carry);
    }
    if (this.pending.length && this.units.length) this.units[this.units.length - 1].blocks.push(...this.pending);
  }
}

function emitContent(el: El, out: Emitter) {
  for (const k of el.kids) {
    if (!isEl(k)) { out.inline(k); continue; }
    emitElement(k, out, () => emitContent(k, out));
  }
}

/** Handles one element; `inner` emits its children in the current context. */
function emitElement(k: El, out: Emitter, inner: () => void) {
  if (k.name === "div") { out.enterDiv(k.attrs.subtype); inner(); out.leaveDiv(); return; }
  switch (k.name) {
    case "p": case "ab": out.startBlock("p"); inner(); out.endBlock(); break;
    case "l": out.startBlock("l", k.attrs.n); inner(); out.endBlock(); break;
    case "head": out.startBlock("head"); inner(); out.endBlock(); break;
    case "speaker": out.setSpeaker(textOf(k)); break;
    case "note": { const t = textOf(k).replace(/\s+/g, " ").trim(); if (t) out.inline({ note: t }); break; }
    case "milestone": if (k.attrs.unit) out.inline({ m: k.attrs.unit.toLowerCase(), n: k.attrs.n }); break;
    case "pb": if (k.attrs.n) out.inline({ m: "page", n: k.attrs.n }); break;
    case "gap": out.inline({ gap: true }); break;
    case "lb": out.inline(" "); break;
    // A regularised form is metadata, not printed text: Perseus uses <reg> for gazetteer entries
    // ("Bodrum [27.466,37.5] (inhabited place)…" beside "Halicarnassus"). The printed text stays.
    case "reg": break;
    default: inner();
  }
}

// ------------------------------------------------------------------ 4. walk the text by the scheme
export function parseTei(xml: string): TeiDoc {
  const { body, patterns, refStates } = buildTree(xml);
  if (!body) return { lang: null, levels: [], units: [], chunks: [] };
  const edition = body.kids.find((k): k is El => isEl(k) && k.name === "div") ?? body;
  const lang = edition.attrs["xml:lang"] ?? null;

  let steps: Step[] | null = null;
  let levels: string[] = [];
  if (patterns.length) {
    // CTS lists the deepest pattern first; take the one with the most $n groups
    const parsed = patterns.map((p) => ({ n: p.n, steps: parsePattern(p.rp) }))
      .filter((p): p is { n: string; steps: Step[] } => !!p.steps);
    parsed.sort((a, b) => b.steps.filter((s) => s.group).length - a.steps.filter((s) => s.group).length);
    if (parsed.length) {
      steps = parsed[0].steps;
      const depth = steps.filter((s) => s.group).length;
      // names: from the patterns, else from <refState>, else from the matched divs' subtypes (filled in below)
      levels = Array.from({ length: depth }, (_, i) =>
        (parsed.find((p) => p.steps.filter((s) => s.group).length === i + 1)?.n || (refStates.length === depth ? refStates[i] : "")).toLowerCase());
    }
  }
  if (!steps || !steps.length) ({ steps, levels } = inferSteps(edition));

  const out = new Emitter();
  const leafIsMilestone = steps[steps.length - 1].name === "milestone";
  const containers: number[] = [];      // for one-level texts: which structural div each passage sits in
  let containerId = 0;

  const visit = (node: El, k: number, matchedHere: boolean, ref: string[]) => {
    for (const c of node.kids) {
      if (!isEl(c)) { out.inline(c); continue; }
      const s = steps![k];
      // "//div[@n]" as the last step matches nested numbered divs too (Andocides' English: "Narrative" holding
      // sections 6–69); the passages are the innermost ones, so a match that holds further matches is passed through
      const nests = s && s.desc && s.group && k === steps!.length - 1 && holds(c, s);
      if (s && (s.desc || matchedHere) && matches(c, s) && !nests) {
        const r = s.group ? [...ref, c.attrs.n] : ref;
        if (s.group && !levels[r.length - 1]) levels[r.length - 1] = (c.attrs.subtype || c.name === "l" && "line" || "part").toLowerCase();
        if (k === steps!.length - 1) {
          out.startUnit(r);
          containers.push(containerId);
          if (leafIsMilestone) continue;                 // runs on until the next milestone
          emitElement(c, out, () => emitContent(c, out));
          out.endUnit();
        } else {
          out.enterDiv(c.name === "div" ? c.attrs.subtype : undefined);
          visit(c, k + 1, true, r);
          out.leaveDiv();
        }
        continue;
      }
      if (node === edition && c.name === "div") containerId++;
      emitElement(c, out, () => visit(c, k, false, ref));
    }
  };
  // the edition div itself is steps[0]
  const start = matches(edition, steps[0]) ? 1 : 0;
  visit(edition, start, true, []);
  out.finish();

  levels = levels.map((l) => l || "part");
  const units = out.units;
  return { lang, levels, units, chunks: makeChunks(units, levels, containers) };
}

// ------------------------------------------------------------------ 5. pages for the reader
function makeChunks(units: Unit[], levels: string[], containers: number[]): TeiDoc["chunks"] {
  const chunks: TeiDoc["chunks"] = [];
  if (!units.length) return chunks;
  const range = (a: number, b: number) => {
    // Perseus's line 0 holds only the first speaker's name, for display: a page starts at line 1 (review fix list, slice 8)
    while (a < b && units[a].ref[units[a].ref.length - 1] === "0") a++;
    const x = units[a].ref.join("."), y = units[b].ref.join(".");
    return x === y ? x : `${x}–${y}`;
  };
  const len = units.map((u) => u.blocks.reduce((n, b) => n + b.c.reduce((m, x) => m + (typeof x === "string" ? x.length : 0), 0), 0));
  const chars = (a: number, b: number) => { let n = 0; for (let i = a; i <= b; i++) n += len[i]; return n; };
  if (levels.length >= 2) {
    // one page per top-level division; a very long one is split by the next level down, and
    // anything still too long into runs, so no page becomes unwieldy. Prose is also measured in
    // letters: a whole book of Aristotle as one page was slow to show on phones, so a long book of
    // prose is cut into runs of its chapters (verse keeps its books whole, as readers expect)
    const MAX = 1500, RUN = 600, PROSE = 16000;
    const isProse = (a: number, b: number) => {
      let l = 0, all = 0;
      for (let i = a; i <= b; i++) for (const x of units[i].blocks) { all++; if (x.t === "l") l++; }
      return l * 2 < all;
    };
    const tooBig = (a: number, b: number, prose: boolean) => b - a + 1 > MAX || (prose && chars(a, b) > PROSE * 1.5);
    const group = (a: number, b: number, depth: number, label: string, prose: boolean) => {
      if (!tooBig(a, b, prose)) { chunks.push({ label, first: a, last: b }); return; }
      if (depth < levels.length - 1) {
        const kids: [number, number][] = [];
        let s = a;
        for (let i = a + 1; i <= b + 1; i++) {
          if (i > b || units[i].ref[depth] !== units[s].ref[depth]) { kids.push([s, i - 1]); s = i; }
        }
        const name = (k: [number, number]) => units[k[0]].ref[depth];
        if (!prose) { for (const k of kids) group(k[0], k[1], depth + 1, `${label}, ${levels[depth]} ${name(k)}`, prose); return; }
        // prose: gather neighbouring divisions into pages of about PROSE letters
        let run: [number, number][] = [];
        const flush = () => {
          if (!run.length) return;
          const [f, l] = [run[0], run[run.length - 1]];
          chunks.push({ label: run.length === 1 ? `${label}, ${levels[depth]} ${name(f)}` : `${label}, ${plural(levels[depth])} ${name(f)}–${name(l)}`, first: f[0], last: l[1] });
          run = [];
        };
        for (const k of kids) {
          if (tooBig(k[0], k[1], prose)) { flush(); group(k[0], k[1], depth + 1, `${label}, ${levels[depth]} ${name(k)}`, prose); continue; }
          if (run.length && (chars(run[0][0], k[1]) > PROSE || k[1] - run[0][0] + 1 > MAX)) flush();
          run.push(k);
        }
        flush();
        return;
      }
      let s = a;
      for (let i = a; i <= b; i++) {
        if (i === b || i - s + 1 >= RUN || (prose && chars(s, i) >= PROSE)) {
          // "Book 2, chapters 1–4" reads better than "Book 2 (2.1–2.4)" when the passages are whole chapters
          const x = units[s].ref[depth], y = units[i].ref[depth];
          const named = depth === levels.length - 1 && units.slice(s, i + 1).every((u, j) => j === 0 || u.ref[depth - 1] === units[s].ref[depth - 1]);
          chunks.push({ label: named ? (x === y ? `${label}, ${levels[depth]} ${x}` : `${label}, ${plural(levels[depth])} ${x}–${y}`) : `${label} (${range(s, i)})`, first: s, last: i });
          s = i + 1;
        }
      }
    };
    let first = 0;
    for (let i = 1; i <= units.length; i++) {
      if (i === units.length || units[i].ref[0] !== units[first].ref[0]) {
        group(first, i - 1, 1, `${cap(levels[0])} ${units[first].ref[0]}`, isProse(first, i - 1));
        first = i;
      }
    }
    return chunks;
  }
  // One-level texts: follow the top-level divisions (a play's scenes) when they give sensible
  // pages; otherwise cut pages of roughly PAGE characters, and keep short works on one page.
  const PAGE = 12000;
  const total = chars(0, units.length - 1);
  const byContainer: TeiDoc["chunks"] = [];
  let first = 0;
  for (let i = 1; i <= units.length; i++) {
    if (i === units.length || containers[i] !== containers[first]) { byContainer.push({ label: "", first, last: i - 1 }); first = i; }
  }
  const sizeOf = (c: { first: number; last: number }) => chars(c.first, c.last);
  let base: TeiDoc["chunks"];
  if (total <= PAGE * 2) base = [{ label: "", first: 0, last: units.length - 1 }];
  else if (byContainer.length > 1 && byContainer.every((c) => sizeOf(c) <= PAGE * 4)) base = byContainer;
  else {
    base = [];
    let start = 0, acc = 0;
    for (let i = 0; i < units.length; i++) {
      acc += len[i];
      if (acc >= PAGE || i === units.length - 1) { base.push({ label: "", first: start, last: i }); start = i + 1; acc = 0; }
    }
  }
  // a page with next to nothing on it (the cast list before a play's first scene, Perseus's hidden
  // line 0) joins the page after it
  for (let i = 0; i < base.length - 1; i++) {
    if (sizeOf(base[i]) < 200) { base[i + 1] = { ...base[i + 1], first: base[i].first }; base.splice(i, 1); i--; }
  }
  return base.map((c) => ({ ...c, label: `${cap(levels[0] ?? "part")}${c.first === c.last ? "" : "s"} ${range(c.first, c.last)}` }));
}

const plural = (s: string) => (s.endsWith("s") ? s : `${s}s`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
