/**
 * The construction finder: sentences found by how they are built, not by their words. Each sentence's
 * structure comes from GLAUx (lib/syntax.ts): every word hangs on another with a role. A search is either
 * a ready-made construction (the genitive absolute, ἄν with the optative…) or one built by the reader:
 * "word A is the [role] of word B", each word given by its dictionary form, its grammar, or both.
 *
 * The treebank's own conventions are looked through, so that what is found is what a grammar book means:
 * - joined words (A καί B) hang on the joining word with "_CO" on their role, and the joining word on
 *   the word they belong to; a word's real governor is found by climbing past the joining word;
 * - a preposition or a subordinating conjunction stands between a word and its governor ("εἰς τὴν
 *   πόλιν ἦλθε": πόλιν hangs on εἰς, εἰς on ἦλθε); the climb goes past those too, and keeps them, to show;
 * - a word shared by joined words (one ἄν for two optatives) hangs on the joining word, and counts for each.
 */
import { packForms, readSentence, sentenceOf, type Sentence, type Syntax } from "@/lib/syntax";
import type { WordPack } from "@/lib/lookup/words";
import { greekKey } from "@/lib/search/codec";
import { detectScript, toPattern, type Script } from "@/lib/search/input";
import { fold } from "@/lib/catalog";

// ------------------------------------------------------------ describing a word
export interface WordSpec {
  /** dictionary form as typed (Greek, transliteration or Beta Code; * and ? allowed); empty: any word */
  lemma?: string;
  /** grammar, as a 9-place GLAUx tag with "-" for "any" ("v---o----": an optative) */
  tag?: string;
}

/** The roles a reader can ask for, in plain words, with the treebank's names for them. */
export const ASK_ROLES: { id: string; label: string; rels: string[] }[] = [
  { id: "obj", label: "object", rels: ["OBJ"] },
  { id: "sbj", label: "subject", rels: ["SBJ"] },
  { id: "pnom", label: "predicate (with “is”, “becomes”)", rels: ["PNOM"] },
  { id: "atr", label: "attribute (describing it)", rels: ["ATR"] },
  { id: "adv", label: "adverbial (how, when, where, why)", rels: ["ADV"] },
  { id: "apos", label: "in apposition", rels: ["APOS"] },
  { id: "ocomp", label: "object complement", rels: ["OCOMP"] },
  { id: "atv", label: "describing the subject during the action", rels: ["ATV", "AtvV"] },
  { id: "any", label: "any role", rels: [] },
];

/** A lemma test built once per search: exact when the reader typed accents, by search key otherwise. */
export interface LemmaTest { exact: string | null; regex: RegExp | null; greek: string }
export function lemmaTest(typed: string, script: Script | "auto" = "auto"): LemmaTest | { error: string } {
  const t = typed.trim().normalize("NFC");
  if (!t) return { exact: null, regex: null, greek: "" };
  const s = script === "auto" ? detectScript(t) : script;
  if (s === "greek" && !/[*?]/.test(t) && fold(t) !== t.toLowerCase()) return { exact: t, regex: null, greek: t };
  const p = toPattern(t, s);
  if ("error" in p) return p;
  return { exact: null, regex: p.regex, greek: p.greek };
}

const tagFits = (tag: string, want?: string) => {
  if (!want) return true;
  for (let i = 0; i < want.length; i++) if (want[i] !== "-" && tag[i] !== want[i]) return false;
  return true;
};

// ------------------------------------------------------------ a work, ready to search
/** A work's words and sentences, laid out flat for quick scanning. */
export interface Corpus {
  work: string;
  pack: WordPack;
  syn: Syntax;
  forms: string[];
  /** for each word of the pack: its index into pack.lemmas / pack.tags */
  lemma: Int32Array;
  tag: Int32Array;
  /** for each word: the GLAUx passage it is in (an index into pack.units) */
  unit: Int32Array;
}

export function corpus(work: string, pack: WordPack, syn: Syntax): Corpus {
  const n = syn.starts[syn.starts.length - 1];
  const lemma = new Int32Array(n), tag = new Int32Array(n), unit = new Int32Array(n);
  let p = 0;
  pack.units.forEach((u, k) => {
    u[2].split(" ").forEach((_, j) => { if (p < n) { lemma[p] = u[3][j]; tag[p] = u[4][j]; unit[p] = k; } p++; });
  });
  return { work, pack, syn, forms: packForms(pack), lemma, tag, unit };
}

// ------------------------------------------------------------ climbing the tree
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

/** The words that hang on node i, including those it shares as one of several joined words. */
export function dependents(s: Sentence, i: number): number[] {
  const out = [...s.nodes[i].kids];
  // shared: i is joined (rel ends _CO) under a joining word, whose other dependents (not joined) belong to every member
  let n = s.nodes[i];
  while (/_CO$/.test(n.rel) && n.head >= 0 && joins(s, n.head)) {
    const c = s.nodes[n.head];
    for (const k of c.kids) if (!/_CO$/.test(s.nodes[k].rel) && !joins(s, k)) out.push(k);
    n = c;
  }
  // joined dependents: a joining word that hangs on i stands for its members
  const expand = (k: number): number[] => (joins(s, k) ? s.nodes[k].kids.filter((c) => /_CO$/.test(s.nodes[c].rel)).flatMap(expand) : [k]);
  return out.flatMap(expand);
}

/** The node whose head is the link (conjunction or preposition) that introduces node i, if any. */
function introducer(s: Sentence, i: number): number {
  let h = s.nodes[i].head, rel = s.nodes[i].rel;
  while (/_CO$/.test(rel) && h >= 0 && joins(s, h)) { rel = s.nodes[h].rel; h = s.nodes[h].head; }
  return h >= 0 && isLink(s.nodes[h].rel) ? h : -1;
}

// ------------------------------------------------------------ searches
export interface Match {
  work: string;
  sentence: number;
  /** the words found (word-pack places), in sentence order */
  words: number[];
  /** A and B for a search built by the reader: their dictionary forms, for the tallies */
  a?: string; b?: string;
}

interface Ctx { c: Corpus; s: Sentence; lemmaOf: (i: number) => string; tagOf: (i: number) => string }
type Finder = (x: Ctx, i: number) => number[] | null;

export interface Preset {
  id: string;
  name: string;
  greek: string;
  about: string;
  /** a first test on the word itself (cheap), before the sentence is read */
  tag: string;
  lemmas?: string[];
  find: Finder;
}

const lemmaIn = (x: Ctx, i: number, ls: string[]) => ls.includes(x.lemmaOf(i));
const caseOf = (x: Ctx, i: number) => x.tagOf(i)[7];
const withKid = (x: Ctx, i: number, test: (k: number) => boolean) => dependents(x.s, i).filter(test);
/** The introducing conjunction of a clause, when it is one of the given words. */
const introducedBy = (x: Ctx, i: number, ls: string[]) => { const h = introducer(x.s, i); return h >= 0 && lemmaIn(x, h, ls) ? h : -1; };

export const PRESETS: Preset[] = [
  {
    id: "gen-abs", name: "Genitive absolute", greek: "τοῦ ἡλίου δύνοντος",
    about: "A participle and its subject, both in the genitive, standing apart from the main sentence to say when, why or although.",
    tag: "v---p--g-",
    find: (x, i) => {
      if (governor(x.s, i).rel !== "ADV") return null;
      const sbj = withKid(x, i, (k) => base(x.s.nodes[k].rel) === "SBJ" && caseOf(x, k) === "g");
      return sbj.length ? [i, ...sbj] : null;
    },
  },
  {
    id: "an-opt", name: "ἄν with the optative", greek: "λέγοιμι ἄν",
    about: "The potential optative: what would or might happen (“I would say”).",
    tag: "v---o----",
    find: (x, i) => { const an = withKid(x, i, (k) => x.lemmaOf(k) === "ἄν"); return an.length ? [i, an[0]] : null; },
  },
  {
    id: "an-ind", name: "ἄν with a past indicative", greek: "ἔλεγον ἄν",
    about: "An imperfect or aorist indicative with ἄν: what would be or would have been so, but is not (unreal conditions, past potential).",
    tag: "v---i----",
    find: (x, i) => {
      if (!"ial".includes(x.tagOf(i)[3])) return null;   // imperfect, aorist, pluperfect
      const an = withKid(x, i, (k) => x.lemmaOf(k) === "ἄν");
      return an.length ? [i, an[0]] : null;
    },
  },
  {
    id: "art-inf", name: "Articular infinitive", greek: "τὸ φιλοσοφεῖν",
    about: "An infinitive with the article, used as a noun (“the act of philosophising”).",
    tag: "v---n----",
    find: (x, i) => { const art = withKid(x, i, (k) => x.lemmaOf(k) === "ὁ" && base(x.s.nodes[k].rel) === "ATR"); return art.length ? [art[0], i] : null; },
  },
  {
    id: "acc-inf", name: "Accusative and infinitive", greek: "φησὶ τὸν ἄνδρα ἐλθεῖν",
    about: "An infinitive with its own subject in the accusative: reported speech after verbs of saying and thinking, and after δεῖ, χρή and the like.",
    tag: "v---n----",
    find: (x, i) => { const sbj = withKid(x, i, (k) => base(x.s.nodes[k].rel) === "SBJ" && caseOf(x, k) === "a"); return sbj.length ? [i, ...sbj] : null; },
  },
  {
    id: "purpose", name: "Purpose clause: ἵνα, ὅπως, ὡς with the subjunctive or optative", greek: "ἵνα μάθῃ",
    about: "“So that…”: ἵνα, ὅπως or ὡς with a subjunctive (or, after a past main verb, often an optative).",
    tag: "v--------",
    find: (x, i) => {
      if (!"so".includes(x.tagOf(i)[4] || "-")) return null;
      const h = introducedBy(x, i, ["ἵνα", "ὅπως", "ὡς"]);
      return h >= 0 ? [h, i] : null;
    },
  },
  {
    id: "result", name: "Result clause: ὥστε", greek: "ὥστε μὴ δύνασθαι",
    about: "“So that, with the result that…”: ὥστε with an infinitive (a natural result) or an indicative (an actual one).",
    tag: "v--------",
    find: (x, i) => {
      if (!"in".includes(x.tagOf(i)[4] || "-")) return null;
      const h = introducedBy(x, i, ["ὥστε"]);
      return h >= 0 ? [h, i] : null;
    },
  },
  {
    id: "ean-subj", name: "ἐάν with the subjunctive", greek: "ἐὰν ἔλθῃ",
    about: "“If (ever)…”, looking ahead or saying what generally happens: ἐάν (ἤν, ἄν) with a subjunctive.",
    tag: "v---s----",
    find: (x, i) => { const h = introducedBy(x, i, ["ἐάν", "ἤν"]); return h >= 0 ? [h, i] : null; },
  },
  {
    id: "ei-opt", name: "εἰ with the optative", greek: "εἰ ἔλθοι",
    about: "“If… should”: a remote possibility in the future, or (after a past verb) what happened whenever.",
    tag: "v---o----",
    find: (x, i) => { const h = introducedBy(x, i, ["εἰ"]); return h >= 0 ? [h, i] : null; },
  },
  {
    id: "prohibit", name: "Prohibition: μή with the imperative or aorist subjunctive", greek: "μὴ φοβοῦ · μὴ φοβηθῇς",
    about: "“Do not…”: μή with a present imperative, or with an aorist subjunctive in the second person.",
    tag: "v--------",
    find: (x, i) => {
      const t = x.tagOf(i);
      if (!(t[4] === "m" || (t[4] === "s" && t[3] === "a" && t[1] === "2"))) return null;
      if (introducer(x.s, i) >= 0) return null;   // not in a clause of its own (ἵνα μὴ…)
      const mh = withKid(x, i, (k) => x.lemmaOf(k) === "μή");
      return mh.length ? [mh[0], i] : null;
    },
  },
  {
    id: "supp-part", name: "τυγχάνω, λανθάνω, φθάνω with a participle", greek: "ἔτυχε παρών",
    about: "A participle that carries the main idea: “happened to be present”, “escaped notice doing”, “did it first”.",
    tag: "v--------", lemmas: ["τυγχάνω", "λανθάνω", "φθάνω"],
    find: (x, i) => {
      const p = withKid(x, i, (k) => x.tagOf(k)[4] === "p" && x.tagOf(k)[0] === "v" && ["SBJ", "OBJ", "PNOM", "ADV", "ATV", "AtvV"].includes(base(x.s.nodes[k].rel)));
      return p.length ? [i, p[0]] : null;
    },
  },
];
/** A search built by the reader: A is the [role] of B. */
export interface Custom { a: WordSpec; role: string; b: WordSpec }

export type Query = { preset: Preset } | { custom: Custom; la: LemmaTest; lb: LemmaTest };

/** Read a search from its parts, or say what is wrong with it. */
export function makeQuery(preset: string | null, custom: Custom | null): Query | { error: string } {
  if (preset) {
    const p = PRESETS.find((x) => x.id === preset);
    return p ? { preset: p } : { error: "That construction is not in the list." };
  }
  if (!custom) return { error: "Choose a construction, or describe one." };
  const la = lemmaTest(custom.a.lemma ?? ""), lb = lemmaTest(custom.b.lemma ?? "");
  if ("error" in la) return { error: `Word A: ${la.error}` };
  if ("error" in lb) return { error: `Word B: ${lb.error}` };
  const said = (w: WordSpec) => !!w.lemma?.trim() || !!w.tag?.replace(/-/g, "");
  if (!said(custom.a) && !said(custom.b)) return { error: "Say something about word A or word B: a dictionary word, or some grammar." };
  if (!ASK_ROLES.some((r) => r.id === custom.role)) return { error: "Choose a role." };
  return { custom, la, lb };
}

function lemmaIds(pack: WordPack, t: LemmaTest): Set<number> | null {
  if (!t.exact && !t.regex) return null;   // any word
  const out = new Set<number>();
  pack.lemmas.forEach((l, i) => {
    if (t.exact ? l.normalize("NFC") === t.exact : t.regex!.test(greekKey(l))) out.add(i);
  });
  return out;
}

/**
 * Every match in one work. `limit` stops early (the tallies then cover the matches found so far).
 * Words are tested cheaply first (dictionary form, grammar), and only then is their sentence read.
 */
export function searchCorpus(c: Corpus, q: Query, limit = Infinity): Match[] {
  const { pack, syn, forms } = c;
  const out: Match[] = [];
  let sn = -1, s: Sentence | null = null;
  const sentence = (p: number) => {
    const k = sentenceOf(syn, p);
    if (k !== sn) { sn = k; s = k >= 0 ? readSentence(syn, k, forms) : null; }
    return s;
  };
  const lemmaOfP = (p: number | null) => (p === null ? "" : pack.lemmas[c.lemma[p]] ?? "");
  const tagOfP = (p: number | null) => (p === null ? "---------" : pack.tags[c.tag[p]] ?? "---------");
  const ctx = (st: Sentence): Ctx => ({ c, s: st, lemmaOf: (i) => lemmaOfP(st.nodes[i].p), tagOf: (i) => tagOfP(st.nodes[i].p) });
  const nodeAt = (st: Sentence, p: number) => st.nodes.find((n) => n.p === p)?.i ?? -1;
  const n = c.lemma.length;

  if ("preset" in q) {
    const { preset } = q;
    const want = preset.lemmas?.length ? new Set(preset.lemmas) : null;
    for (let p = 0; p < n && out.length < limit; p++) {
      if (!tagFits(pack.tags[c.tag[p]] ?? "", preset.tag)) continue;
      if (want && !want.has(pack.lemmas[c.lemma[p]])) continue;
      const st = sentence(p);
      if (!st) continue;
      const i = nodeAt(st, p);
      if (i < 0) continue;
      const found = preset.find(ctx(st), i);
      if (found) out.push({ work: c.work, sentence: sn, words: found.map((k) => st.nodes[k].p).filter((x): x is number => x !== null).sort((x, y) => x - y) });
    }
    return out;
  }

  const { custom, la, lb } = q;
  const aIds = lemmaIds(pack, la), bIds = lemmaIds(pack, lb);
  const rels = ASK_ROLES.find((r) => r.id === custom.role)!.rels;
  // start from whichever word is narrower: A when it is given, else B
  const fromA = !!aIds || !!custom.a.tag?.replace(/-/g, "") || !bIds;
  for (let p = 0; p < n && out.length < limit; p++) {
    const ids = fromA ? aIds : bIds, spec = fromA ? custom.a : custom.b;
    if (ids && !ids.has(c.lemma[p])) continue;
    if (!tagFits(pack.tags[c.tag[p]] ?? "", spec.tag)) continue;
    if ((pack.tags[c.tag[p]] ?? "").startsWith("u")) continue;   // punctuation
    const st = sentence(p);
    if (!st) continue;
    const i = nodeAt(st, p);
    if (i < 0) continue;
    const x = ctx(st);
    const fitsB = (k: number) => (!bIds || bIds.has(c.lemma[st.nodes[k].p ?? -1] ?? -1)) && tagFits(x.tagOf(k), custom.b.tag) && st.nodes[k].p !== null;
    const fitsA = (k: number) => (!aIds || aIds.has(c.lemma[st.nodes[k].p ?? -1] ?? -1)) && tagFits(x.tagOf(k), custom.a.tag) && st.nodes[k].p !== null && !x.tagOf(k).startsWith("u");
    const roleOk = (rel: string) => !rels.length || rels.includes(rel);
    if (fromA) {
      const { g, rel, via } = governor(st, i);
      if (g < 0 || !roleOk(rel) || !fitsB(g)) continue;
      const words = [i, g, ...via].map((k) => st.nodes[k].p).filter((v): v is number => v !== null).sort((a, b) => a - b);
      out.push({ work: c.work, sentence: sn, words, a: x.lemmaOf(i), b: x.lemmaOf(g) });
    } else {
      // B given, A open: everything that plays the role for B
      for (const k of st.nodes.map((nd) => nd.i)) {
        if (k === i || !fitsA(k)) continue;
        const { g, rel, via } = governor(st, k);
        if (g !== i || !roleOk(rel)) continue;
        const words = [k, i, ...via].map((m) => st.nodes[m].p).filter((v): v is number => v !== null).sort((a, b) => a - b);
        out.push({ work: c.work, sentence: sn, words, a: x.lemmaOf(k), b: x.lemmaOf(i) });
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

/** Which dictionary words fill the open slot most often: what λέγω takes as its object, say. */
export function tally(matches: Match[], side: "a" | "b"): [string, number][] {
  const m = new Map<string, number>();
  for (const x of matches) { const l = x[side]; if (l) m.set(l, (m.get(l) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "el"));
}

/** A sentence's words, with the found ones marked, for showing a result. */
export function sentenceParts(c: Corpus, m: Match): { t: string; hit: boolean }[] {
  const from = c.syn.starts[m.sentence], to = c.syn.starts[m.sentence + 1];
  const hits = new Set(m.words);
  const out: { t: string; hit: boolean }[] = [];
  for (let p = from; p < to; p++) {
    const f = c.forms[p];
    if (!f) continue;
    out.push({ t: f, hit: hits.has(p) });
  }
  return out;
}

/**
 * GLAUx's reference for a word, from its passage's attributes, leaving out any a later one spells out
 * in full: ["1.1", "1"] → "1.1"; ["1", "327", "327", "327a"] (book, section, Stephanus page and
 * section) → "1.327a".
 */
export function refOf(c: Corpus, p: number): string {
  const u = c.pack.units[c.unit[p]];
  if (!u) return "";
  const vals = u[0].filter(Boolean);
  return vals.filter((v, i) => vals.indexOf(v) === i && !vals.some((w) => w !== v && w.startsWith(v) && /^[.a-z]/.test(w.slice(v.length)))).join(".");
}

/** Whether a person checked the sentence (a treebank) or GLAUx's computer analysis made it. */
export const checkedByHand = (c: Corpus, m: Match) => c.syn.raw.s[m.sentence]?.[0] === 1;
