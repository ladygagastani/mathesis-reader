/**
 * How each sentence is built, from GLAUx (built by pipeline/build_syntax.py): every word hangs on another,
 * its head, with a role (subject, object, attribute…); the main verb hangs on nothing. The words come in the
 * same order as the word pack's (lookup/words.ts), so a word on screen is found through its place in GLAUx
 * (lookup/placed.ts, Placed.word).
 */
import { PACKS } from "@/config/packs";
import type { WordPack } from "@/lib/lookup/words";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

interface Raw { v: 1; work: string; glaux: string; sha: string; licence: string; rels: string[]; s: ([number, string] | [number, string, [number, string][]])[] }
export interface Syntax { raw: Raw; /** the word-pack index of each sentence's first word (length: sentences + 1) */ starts: Int32Array }

export interface SynNode {
  i: number;
  /** the word's place in the word pack, or null for punctuation and words the annotators supplied */
  p: number | null;
  /** the word as printed ("" for a supplied word, which GLAUx does not name) */
  form: string;
  head: number;          // -1: hangs on nothing
  rel: string;           // the relation, as GLAUx writes it (OBJ, ATR_CO…)
  kids: number[];
}
export interface Sentence { n: number; manual: boolean; nodes: SynNode[]; roots: number[] }

const loaded = new Map<string, Promise<Syntax | null>>();

/** The sentence structure of a work, or null if there is none. */
export function loadSyntax(work: string): Promise<Syntax | null> {
  if (!loaded.has(work)) {
    loaded.set(work, (async () => {
      const res = await fetch(`${PACKS}/syntax/${work}.json`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`sentence analyses unavailable (${res.status})`);
      return readSyntax((await res.json()) as Raw);
    })().catch((e) => { loaded.delete(work); throw e; }));
  }
  return loaded.get(work)!;
}

/** Index a work's sentences by the word-pack place of their first word. */
export function readSyntax(raw: Raw): Syntax {
  const starts = new Int32Array(raw.s.length + 1);
  let p = 0;
  raw.s.forEach((s, k) => {
    starts[k] = p;
    let tokens = 0;
    for (let i = 0; i < s[1].length; tokens++) i += s[1][i + 1] === "!" ? 4 : 2;
    p += tokens - (s[2]?.length ?? 0);
  });
  starts[raw.s.length] = p;
  return { raw, starts };
}

/** The sentence holding the word at word-pack place p (binary search), or -1. */
export function sentenceOf(syn: Syntax, p: number): number {
  const { starts } = syn;
  if (p < 0 || p >= starts[starts.length - 1]) return -1;
  let lo = 0, hi = starts.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= p) lo = mid; else hi = mid - 1; }
  return lo;
}

const formsCache = new WeakMap<WordPack, string[]>();
/** Every word of the word pack, in order. */
export function packForms(pack: WordPack): string[] {
  let f = formsCache.get(pack);
  if (!f) { f = pack.units.flatMap((u) => u[2].split(" ")); formsCache.set(pack, f); }
  return f;
}

/** One sentence as a tree. `forms` are the word pack's words (packForms). */
export function readSentence(syn: Syntax, n: number, forms: string[]): Sentence {
  const [manual, code, extras = []] = syn.raw.s[n];
  const extra = new Map(extras);
  const nodes: SynNode[] = [];
  let p = syn.starts[n];
  for (let c = 0, i = 0; c < code.length; i++) {
    const rel = syn.raw.rels[B64.indexOf(code[c])] ?? "";
    let head: number;
    if (code[c + 1] === "~") { head = -1; c += 2; }
    else if (code[c + 1] === "!") { head = B64.indexOf(code[c + 2]) * 64 + B64.indexOf(code[c + 3]); c += 4; }
    else { head = i + B64.indexOf(code[c + 1]) - 31; c += 2; }
    const isExtra = extra.has(i);
    nodes.push({ i, p: isExtra ? null : p, form: isExtra ? extra.get(i)! : forms[p] ?? "", head, rel, kids: [] });
    if (!isExtra) p++;
  }
  const roots: number[] = [];
  for (const nd of nodes) { if (nd.head >= 0 && nodes[nd.head]) nodes[nd.head].kids.push(nd.i); else roots.push(nd.i); }
  return { n, manual: manual === 1, nodes, roots };
}

/** A node and everything that hangs on it, in word order: the phrase it heads. */
export function phraseOf(s: Sentence, i: number): number[] {
  const out: number[] = [];
  const walk = (k: number) => { out.push(k); for (const c of s.nodes[k].kids) walk(c); };
  walk(i);
  return out.sort((a, b) => a - b);
}

// ------------------------------------------------------------ the word a word belongs to
const base = (rel: string) => rel.replace(/_(CO|AP)$/, "");
/** A joining word: marked COORD, or (in GLAUx's computer analysis, at times) any word with joined words on it. */
const joins = (s: Sentence, h: number) => base(s.nodes[h].rel) === "COORD" || s.nodes[h].kids.some((k) => /_CO$/.test(s.nodes[k].rel));
const isLink = (rel: string) => { const b = base(rel); return b === "AuxP" || b === "AuxC"; };

/**
 * The word that node i really belongs to, and the role it plays there: past joining words (whose role,
 * for a joined word, is the one the whole group plays), prepositions and subordinating conjunctions.
 * `via` holds the words climbed past that are worth showing (prepositions and conjunctions).
 */
export function governor(s: Sentence, i: number): { g: number; rel: string; via: number[] } {
  const own = s.nodes[i];
  const via: number[] = [];
  let h = own.head;
  // a word shared by joined words (one ἄν for two verbs) hangs on the joining word itself: it belongs to its first member
  if (!/_CO$/.test(own.rel) && h >= 0 && joins(s, h)) {
    const first = members(s, h)[0];
    return { g: first ?? -1, rel: base(own.rel), via };
  }
  // climb past joining words (a joined word plays its own role, written without "_CO"), prepositions and conjunctions
  for (let guard = 0; h >= 0 && guard < 30; guard++) {
    const hn = s.nodes[h];
    if (isLink(hn.rel)) { via.push(h); h = hn.head; continue; }
    if (joins(s, h)) { h = hn.head; continue; }
    break;
  }
  return { g: h, rel: base(own.rel), via };
}

/** The joined words under a joining word, looking inside joining words joined in turn. */
function members(s: Sentence, c: number): number[] {
  return s.nodes[c].kids.filter((k) => /_CO$/.test(s.nodes[k].rel)).flatMap((k) => (joins(s, k) ? members(s, k) : [k]));
}

// ------------------------------------------------------------ what the roles mean
/**
 * The relations of the Ancient Greek Dependency Treebank, in plain words, after its guidelines
 * (G. Celano, "Guidelines for the Ancient Greek Dependency Treebank 2.0").
 */
export const ROLES: Record<string, { name: string; about: string; kind: "verb" | "core" | "describe" | "link" | "aside" }> = {
  PRED: { name: "main verb", about: "The verb of the main clause: the sentence is built round it.", kind: "verb" },
  SBJ: { name: "subject", about: "Who or what does the action, or is described.", kind: "core" },
  OBJ: { name: "object", about: "What the verb (or an adjective or adverb) needs to complete it: what is done, given, seen…", kind: "core" },
  PNOM: { name: "predicate", about: "What the subject is said to be, with a verb like “is” or “becomes”.", kind: "core" },
  OCOMP: { name: "object complement", about: "What the object is made, called or found to be.", kind: "core" },
  ATR: { name: "attribute", about: "Describes a noun: an article, an adjective, a genitive of whose…", kind: "describe" },
  ADV: { name: "adverbial", about: "Adds how, when, where, why or how much to a verb, adjective or adverb.", kind: "describe" },
  ATV: { name: "describing the subject", about: "An adjective that agrees with the subject but says something about the action.", kind: "describe" },
  AtvV: { name: "describing the subject", about: "An adjective that agrees with the subject but says something about the action.", kind: "describe" },
  APOS: { name: "in apposition", about: "Another name for the same person or thing, set beside it.", kind: "describe" },
  COORD: { name: "joins", about: "A word (καί, δέ, ἤ…) or a comma that joins words or clauses of the same kind; they hang on it.", kind: "link" },
  AuxP: { name: "preposition", about: "Its noun hangs on it, and together they modify another word.", kind: "link" },
  AuxC: { name: "subordinating conjunction", about: "Introduces a clause (ὅτι, ἐπεί, εἰ, ἵνα…); the clause's verb hangs on it.", kind: "link" },
  AuxY: { name: "sentence particle", about: "A particle for the whole sentence (γάρ, οὖν…), or the first of a correlated pair (μέν… δέ).", kind: "link" },
  AuxZ: { name: "emphasis or negation", about: "A little word such as “not”, “even” or “also”.", kind: "link" },
  AuxX: { name: "comma", about: "A comma.", kind: "link" },
  AuxG: { name: "punctuation", about: "Punctuation (inverted commas, brackets).", kind: "link" },
  AuxK: { name: "end of the sentence", about: "The full stop, Greek question mark or raised point.", kind: "link" },
  AuxV: { name: "auxiliary verb", about: "A verb that helps another verb.", kind: "link" },
  AuxR: { name: "reflexive", about: "A reflexive word that goes with the verb.", kind: "link" },
  ExD: { name: "outside the sentence", about: "Not part of the sentence's structure: someone addressed (a vocative), or an aside.", kind: "aside" },
  MWE: { name: "part of a set phrase", about: "One word of a fixed expression, hanging on its main word.", kind: "link" },
  MWE2: { name: "part of a set phrase", about: "One word of a fixed expression, hanging on its main word.", kind: "link" },
};

/** A relation in plain words: "object, one of several joined". */
export function roleOf(rel: string): { name: string; about: string; kind: (typeof ROLES)[string]["kind"]; joined: boolean; apposed: boolean } {
  const joined = /_CO$/.test(rel), apposed = /_AP$/.test(rel);
  const base = rel.replace(/_(CO|AP)$/, "");
  const r = ROLES[base] ?? { name: base || "role not given", about: "", kind: "link" as const };
  return { ...r, joined, apposed };
}
