/**
 * What the library says about each work beside its title (docs/review-2026-11-12.md: the old library's rows), and the filters made
 * from it: the date and period, the dialect, the length, and how familiar its words are. From the old site's data, read when the
 * library opens: data/works-meta.json (GLAUx's metadata: genre, dialect, dates by century, running words) and data/difficulty.json
 * (the share of a text's running words among the 516 core words, the commonest in Greek: Dickinson College Commentaries' core list,
 * counted over the GLAUx analysis). Lifted from the old app's lib/works-meta.ts and lib/difficulty.ts.
 */
import { DATA_SITE } from "@/config/packs";

/** GLAUx's metadata for a work. Its dates are the first and last years of the centuries of its author's life. */
export interface WorkFacts { genre: string | null; dialect?: string | null; from?: number | null; to?: number | null; tokens?: number | null }

let difficulty: Promise<Record<string, [number, number]>> | null = null;
/** For each work: its analysed running words, and how many in a thousand are core words. */
export function loadDifficulty(): Promise<Record<string, [number, number]>> {
  difficulty ??= fetch(`${DATA_SITE}/data/difficulty.json`)
    .then((r) => (r.ok ? r.json() : { works: {} }))
    .then((d: { works?: Record<string, [number, number]> }) => d.works ?? {})
    .catch(() => ({}));
  return difficulty;
}

/** Texts shorter than this are too short to rate. */
export const MIN_WORDS = 2000;

/** The share of core words, in whole percent; null when the text is too short or not analysed. */
export const commonShare = (d: [number, number] | undefined): number | null => (d && d[0] >= MIN_WORDS ? Math.round(d[1] / 10) : null);

export type Vocab = "familiar" | "mixed" | "rare";
export const VOCAB: [id: Vocab, label: string, test: (pct: number) => boolean][] = [
  ["familiar", "Mostly familiar words (80% or more)", (p) => p >= 80],
  ["mixed", "Familiar and rarer words (70–79%)", (p) => p >= 70 && p < 80],
  ["rare", "Many rarer words (under 70%)", (p) => p < 70],
];
export const vocabOf = (pct: number | null): Vocab | null => (pct === null ? null : VOCAB.find(([, , t]) => t(pct))?.[0] ?? null);

/** The periods, by the century a work's author's life began in. */
export const PERIODS: [label: string, test: (from: number) => boolean][] = [
  ["Archaic · 8th–6th c. BC", (y) => y <= -600],
  ["Classical · 5th–4th c. BC", (y) => y > -600 && y <= -400],
  ["Hellenistic · 3rd–1st c. BC", (y) => y > -400 && y <= -100],
  ["Roman · 1st–3rd c. AD", (y) => y > -100 && y <= 201],
  ["Late Antique · 4th c. AD and later", (y) => y > 201],
];
export const UNDATED = "Not dated";
export const periodOf = (from: number | null | undefined): string => (from === null || from === undefined ? UNDATED : PERIODS.find(([, f]) => f(from))?.[0] ?? UNDATED);

/** -500 is "5th c. BC", 101 is "2nd c. AD". */
export function century(from: number | null | undefined): string | null {
  if (from === null || from === undefined) return null;
  const n = from < 0 ? Math.ceil(-from / 100) : Math.floor((from - 1) / 100) + 1;
  const suf = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suf} c. ${from < 0 ? "BC" : "AD"}`;
}

/** The span GLAUx gives, by century: -500 to -301 is "5th–4th c. BC". (A span: GLAUx dates a work by its author's lifetime.) */
export function centuries(from: number | null | undefined, to: number | null | undefined): string | null {
  const a = century(from);
  if (!a || to === null || to === undefined) return a;
  const b = century(to);
  if (!b || a === b) return a;
  const [na, ea] = [a.replace(/ c\. (BC|AD)$/, ""), a.slice(-2)];
  return ea === b.slice(-2) ? `${na}–${b}` : `${a} – ${b}`;
}

/** A work's length in words, rounded as a reader would say it: "850 words", "12,000 words", "130,000 words". */
export function length(tokens: number | null | undefined): string | null {
  if (!tokens || tokens < 100) return null;
  const round = tokens < 1000 ? 50 : tokens < 10_000 ? 500 : 1000;
  return `${(Math.round(tokens / round) * round || round).toLocaleString("en-GB")} words`;
}

/** The library's filters: a period, a dialect, a vocabulary band; empty means any. */
export interface Filters { period: string; dialect: string; vocab: string }
export const NO_FILTERS: Filters = { period: "", dialect: "", vocab: "" };

/** Does a work pass the filters? */
export function passes(id: string, f: Filters, meta: Record<string, WorkFacts>, diff: Record<string, [number, number]>): boolean {
  const m = meta[id];
  if (f.period && periodOf(m?.from) !== f.period) return false;
  if (f.dialect && (m?.dialect ?? "") !== f.dialect) return false;
  if (f.vocab && vocabOf(commonShare(diff[id])) !== f.vocab) return false;
  return true;
}

/** The dialects the works are in, commonest first. */
export function dialects(meta: Record<string, WorkFacts>): string[] {
  const n = new Map<string, number>();
  for (const m of Object.values(meta)) if (m.dialect) n.set(m.dialect, (n.get(m.dialect) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}
