/**
 * What the reader types into a search box, turned into a pattern over search keys
 * (greekKey: lower-case Greek letters, no accents or breathings, σ for every sigma).
 *
 * Three ways of typing Greek are understood:
 * - Greek letters, with or without accents;
 * - Latin letters, in the site's own transliteration (see lib/translit.ts): th θ, ph φ, ch/kh χ,
 *   ps ψ, x ξ, ē η, ō ω, y/u υ, ng γγ… A plain e or o also finds η or ω, since beginners often
 *   leave out the long marks;
 * - Beta Code, the TLG's ASCII scheme (a)/nqrwpos → ἄνθρωπος), recognised by its marks ) ( / \ = | *
 *   or chosen explicitly.
 * Wildcards: * for any letters, ? for exactly one.
 */
import { fold } from "@/lib/catalog";

export type Script = "greek" | "translit" | "beta";

type Tok = string | "*" | "?";   // a set of letters (one position), or a wildcard

export interface KeyPattern {
  regex: RegExp;          // matches whole keys
  prefixes: string[];     // the index shards the key can be in: its first two letters, every way they can be read
  open: boolean;          // prefixes are single letters and any shard starting with one may hold matches
  greek: string;          // the Greek we are searching for, for showing back ("λογος", "λ?γος")
  loose: boolean;         // e/o also stand for η/ω
}

const LETTERS = "αβγδεζηθικλμνξοπρστυφχψωϝ";

export function detectScript(q: string): Script {
  if (/[Ͱ-Ͽἀ-῿]/u.test(q)) return "greek";
  if (/[()/\\=|]|\*[a-z]/i.test(q)) return "beta";
  return "translit";
}

// ------------------------------------------------------------ Beta Code → Greek
const BETA: Record<string, string> = {
  a: "α", b: "β", g: "γ", d: "δ", e: "ε", z: "ζ", h: "η", q: "θ", i: "ι", k: "κ", l: "λ", m: "μ", n: "ν",
  c: "ξ", o: "ο", p: "π", r: "ρ", s: "σ", t: "τ", u: "υ", f: "φ", x: "χ", y: "ψ", w: "ω", v: "ϝ",
};
const MARK: Record<string, string> = { ")": "̓", "(": "̔", "/": "́", "\\": "̀", "=": "͂", "+": "̈", "|": "ͅ" };

/** Beta Code (either case, capitals marked with *) to Greek, with its accents. */
export function betaToGreek(s: string): string {
  let out = "";
  const src = s.toLowerCase();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "*") {
      // capital: *)a or *a) — marks may come before the letter
      let marks = "";
      let j = i + 1;
      while (j < src.length && MARK[src[j]]) marks += MARK[src[j++]];
      const l = BETA[src[j]];
      if (!l) { out += c; continue; }
      out += l.toUpperCase() + marks;
      i = j;
      continue;
    }
    if (BETA[c]) {
      // s1 / s2 / s3: medial, final, lunate sigma
      if (c === "s" && /[123]/.test(src[i + 1] ?? "")) { out += src[i + 1] === "2" ? "ς" : src[i + 1] === "3" ? "ϲ" : "σ"; i++; continue; }
      out += BETA[c];
    } else if (MARK[c]) out += MARK[c];
    else out += c;
  }
  return out.normalize("NFC").replace(/σ(?=$|[^\p{L}\p{M}])/gu, "ς");
}

// ------------------------------------------------------------ transliteration → letter sets
const TRANSLIT: [string, string][] = [
  // longest first
  ["nch", "γχ"], ["nkh", "γχ"], ["rrh", "ρρ"],
  ["th", "θ"], ["ph", "φ"], ["ch", "χ"], ["kh", "χ"], ["ps", "ψ"], ["rh", "ρ"],
  ["ng", "γγ"], ["nk", "γκ"], ["nx", "γξ"],
  ["ē", "η"], ["ō", "ω"], ["ê", "η"], ["ô", "ω"],
  ["a", "α"], ["b", "β"], ["g", "γ"], ["d", "δ"], ["e", "ε"], ["z", "ζ"], ["i", "ι"], ["k", "κ"], ["c", "κ"],
  ["l", "λ"], ["m", "μ"], ["n", "ν"], ["x", "ξ"], ["o", "ο"], ["p", "π"], ["r", "ρ"], ["s", "σ"],
  ["t", "τ"], ["y", "υ"], ["u", "υ"], ["f", "φ"], ["q", "θ"], ["w", "ω"], ["j", "ι"], ["v", "β"],
];

function translitToks(s: string): { toks: Tok[]; greek: string; loose: boolean } | { error: string } {
  // accents and a leading h (rough breathing) carry no letter
  let w = s.toLowerCase().normalize("NFD").replace(/[̀-̃̆-ͯ]/g, "").normalize("NFC");
  w = w.replace(/^h(?=[aeiouyēōêô])/, "").replace(/(^|[^a-z])h/g, "$1");
  const toks: Tok[] = [];
  let greek = "", loose = false;
  for (let i = 0; i < w.length;) {
    const c = w[i];
    if (c === "*" || c === "?") { toks.push(c); greek += c; i++; continue; }
    const hit = TRANSLIT.find(([lat]) => w.startsWith(lat, i));
    if (!hit) {
      if (c === "h") { i++; continue; }   // an h inside a word (after a consonant already read) is a breathing
      return { error: `“${c}” is not a letter this search understands` };
    }
    const [lat, gr] = hit;
    for (const g of gr) {
      if (lat === "e") { toks.push("εη"); loose = true; }
      else if (lat === "o") { toks.push("οω"); loose = true; }
      else toks.push(g);
    }
    greek += gr;
    i += lat.length;
  }
  return { toks, greek: greek.replace(/σ$/, "ς"), loose };   // a word ends in ς
}

function greekToks(s: string): Tok[] {
  const toks: Tok[] = [];
  for (const c of fold(s)) {
    if (c === "*" || c === "?") toks.push(c);
    else if (LETTERS.includes(c)) toks.push(c);
  }
  return toks;
}

/** One typed word → a key pattern, or a plain-English reason it cannot be searched. */
export function toPattern(word: string, script: Script): KeyPattern | { error: string } {
  let toks: Tok[];
  let greek: string, loose = false;
  if (script === "translit") {
    const r = translitToks(word);
    if ("error" in r) return r;
    ({ toks, greek, loose } = r);
  } else {
    greek = script === "beta" ? betaToGreek(word) : word.normalize("NFC");
    toks = greekToks(greek);
  }
  if (!toks.some((t) => t !== "*" && t !== "?")) return { error: "Type at least one letter." };
  if (toks[0] === "*" || toks[0] === "?") return { error: "Start with a letter: a wildcard can come anywhere but first." };

  const source = toks.map((t) => (t === "*" ? "[^ ]*" : t === "?" ? "." : t.length > 1 ? `[${t}]` : t)).join("");
  // which shards: the first two letters, every way they can be read (a lone letter is its own shard)
  let prefixes = [...(toks[0] as string)];
  const second = toks[1];
  const open = second === "*" || second === "?";
  if (second !== undefined && !open) prefixes = prefixes.flatMap((p) => [...second].map((c) => p + c));
  return { regex: new RegExp(`^${source}$`), prefixes, open, greek, loose };
}

/** Split a query into words (a phrase), keeping wildcards. */
export const queryWords = (q: string) => q.trim().split(/[\s,.;:·]+/).filter(Boolean);
