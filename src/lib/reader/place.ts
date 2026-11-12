/**
 * Where you stopped in each book, kept on this device (docs/review-2026-11-12.md, "Remembers your place"): the passage at the top of
 * the screen, the page it is on, the edition and translation you chose, and when. A book opened again opens there, and the library
 * lists the books you are reading, newest first.
 */
export interface Place {
  /** the passage at the top of the screen ("17", "1.120") */
  at: string;
  /** the page's name ("Sections 17–22") */
  where: string;
  /** the book's name ("Plato, Apology") */
  book: string;
  /** the Greek edition and the translation chosen (their versions, "perseus-grc2"; "none" for no translation), when not the first */
  ed?: string;
  tr?: string;
  /** when, in ms */
  t: number;
}

export const PLACES_KEY = "mathesis-reader:places";
const MAX = 60;

function all(): Record<string, Place> {
  try {
    const got = JSON.parse(localStorage.getItem(PLACES_KEY) ?? "{}");
    return got && typeof got === "object" && !Array.isArray(got) ? got : {};
  } catch { return {}; }
}

export function getPlace(work: string): Place | null {
  const p = all()[work];
  return p && typeof p.at === "string" && typeof p.t === "number" ? p : null;
}

/** Keep where you are in a book. Only the newest MAX books are kept. */
export function savePlace(work: string, place: Omit<Place, "t">, now = Date.now()) {
  const a = all();
  a[work] = { ...place, t: now };
  const kept = Object.entries(a).sort((x, y) => y[1].t - x[1].t).slice(0, MAX);
  try { localStorage.setItem(PLACES_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* storage full or blocked: not kept */ }
}

/** The books you are reading, newest first. */
export function recentPlaces(n = 4): [string, Place][] {
  return Object.entries(all()).filter(([, p]) => typeof p?.t === "number" && typeof p.at === "string").sort((a, b) => b[1].t - a[1].t).slice(0, n);
}

/** Forget a book's place (the library's "Continue reading" offers it no more). */
export function forgetPlace(work: string) {
  const a = all();
  delete a[work];
  try { localStorage.setItem(PLACES_KEY, JSON.stringify(a)); } catch { /* storage blocked */ }
}
