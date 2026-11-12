/**
 * Genre, dialect and date of each work, from GLAUx's metadata (web/public/data/works-meta.json,
 * built by pipeline/build_words.py). GLAUx dates works by century, so periods here are by century too.
 */
export interface WorkMeta { genre: string | null; dialect: string | null; from: number | null; to: number | null; tokens: number | null }

let pending: Promise<Record<string, WorkMeta>> | null = null;
export function loadWorksMeta(): Promise<Record<string, WorkMeta>> {
  pending ??= fetch("/data/works-meta.json").then((r) => (r.ok ? r.json() : { works: {} })).then((d) => d.works ?? {}).catch(() => ({}));
  return pending;
}

/** Genre families for filtering, each listing the GLAUx genres it contains. */
export const FAMILIES: [string, string[]][] = [
  ["Epic", ["Epic poetry"]],
  ["Lyric and elegy", ["Lyric poetry"]],
  ["Drama", ["Tragedy", "Comedy"]],
  ["History and biography", ["History", "Biography", "Military", "Geography"]],
  ["Philosophy", ["Philosophy", "Philosophic Dialogue", "Dialogue"]],
  ["Oratory and rhetoric", ["Oratory", "Rhetoric"]],
  ["Letters", ["Epistolography"]],
  ["Medicine", ["Medicine", "Biology"]],
  ["Science and mathematics", ["Mathematics", "Astronomy/Astrology", "Physics", "Engineering", "Scientific Poetry", "Music", "Alchemy"]],
  ["Novels, myths and marvels", ["Narrative", "Mythography", "Paradoxography"]],
  ["Religion", ["Theology", "Religious Epistle", "Religious History", "Religious Prophecy", "Religious Narrative", "Religious Poetry", "Religious Wisdom"]],
  ["Scholarship", ["Commentary", "Language", "Polyhistory", "Art", "Oneirocritic"]],
];
export const familyOf = (genre: string | null) => (genre ? FAMILIES.find(([, gs]) => gs.includes(genre))?.[0] ?? null : null);

/** Periods by century of the start date (GLAUx's "from" is the first year of a century). */
export const PERIODS: [string, (from: number) => boolean][] = [
  ["Archaic · 8th–6th c. BC", (y) => y <= -600],
  ["Classical · 5th–4th c. BC", (y) => y > -600 && y <= -400],
  ["Hellenistic · 3rd–1st c. BC", (y) => y > -400 && y <= -100],
  ["Roman · 1st–3rd c. AD", (y) => y > -100 && y <= 201],
  ["Late Antique · 4th c. AD and later", (y) => y > 201],
];
export const periodOf = (from: number | null) => (from === null ? null : PERIODS.find(([, f]) => f(from))?.[0] ?? null);

/** -500 → "5th c. BC", 101 → "2nd c. AD" */
export function century(from: number | null): string | null {
  if (from === null) return null;
  const n = from < 0 ? Math.ceil(-from / 100) : Math.floor((from - 1) / 100) + 1;   // 500–401 BC is the 5th century
  const suf = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suf} c. ${from < 0 ? "BC" : "AD"}`;
}

/**
 * The span GLAUx gives, by century: {from: -500, to: -301} → "5th–4th c. BC". GLAUx dates a work
 * by its author's lifetime, so a span is the honest reading; a single century would claim too much.
 */
export function centuries(from: number | null, to: number | null): string | null {
  const a = century(from);
  if (!a || to === null) return a;
  const b = century(to);
  if (!b || a === b) return a;
  const [na, ea] = [a.replace(/ c\. (BC|AD)$/, ""), a.slice(-2)];
  return ea === b.slice(-2) ? `${na}–${b}` : `${a} – ${b}`;
}
export const DATE_NOTE = "Date span as GLAUx gives it, by century of the author's life";

