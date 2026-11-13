/**
 * The narrator's settings, kept on this device: the voice, its speed and pitch, the pause between passages, whether the page follows
 * the voice and marks each word, and the reader's own pronunciations. Also where the voice stopped in each book, so Listen goes on
 * from there. Written the way lib/settings.ts writes the reader's settings: anything unknown or out of range falls back to the default.
 */
import type { SayAs } from "./text";

export type Gap = "none" | "short" | "long";
export interface Prefs {
  /** the voice's voiceURI; "" for the best the device has */
  voice: string;
  rate: number;
  pitch: number;
  gap: Gap;
  /** scroll so the sentence being read stays in sight */
  follow: boolean;
  /** mark each word as it is said (where the voice reports its words) */
  words: boolean;
  say: SayAs[];
}

export const RATES = { min: 0.5, max: 2.5, step: 0.05 } as const;
export const PITCHES = { min: 0.5, max: 1.5, step: 0.05 } as const;
export const GAPS: Record<Gap, number> = { none: 0, short: 450, long: 1200 };
export const NARRATOR_DEFAULTS: Prefs = { voice: "", rate: 1, pitch: 1, gap: "short", follow: true, words: true, say: [] };
export const PREFS_KEY = "mathesis-reader:narrator";
export const HEARD_KEY = "mathesis-reader:heard";

const inRange = (x: unknown, r: { min: number; max: number }) => typeof x === "number" && x >= r.min && x <= r.max;
const round = (x: number) => Math.round(x * 100) / 100;

export function readPrefs(raw: string | null): Prefs {
  let p: Record<string, unknown> = {};
  try { p = (JSON.parse(raw ?? "{}") as typeof p) ?? {}; } catch { /* a damaged value: the defaults */ }
  const d = NARRATOR_DEFAULTS;
  const say = Array.isArray(p.say)
    ? p.say.filter((x): x is SayAs => !!x && typeof x.write === "string" && typeof x.say === "string" && !!x.write.trim() && x.write.length <= 80 && x.say.length <= 120).slice(0, 200)
    : d.say;
  return {
    voice: typeof p.voice === "string" && p.voice.length < 300 ? p.voice : d.voice,
    rate: inRange(p.rate, RATES) ? round(p.rate as number) : d.rate,
    pitch: inRange(p.pitch, PITCHES) ? round(p.pitch as number) : d.pitch,
    gap: p.gap === "none" || p.gap === "short" || p.gap === "long" ? p.gap : d.gap,
    follow: typeof p.follow === "boolean" ? p.follow : d.follow,
    words: typeof p.words === "boolean" ? p.words : d.words,
    say: say.map((x) => ({ write: x.write.trim(), say: x.say.trim() })),
  };
}

/** A pronunciation added: one for the same written word takes the place of the old one. */
export function addSayAs(list: SayAs[], write: string, say: string): SayAs[] {
  const w = write.trim(), s = say.trim();
  if (!w || !s) return list;
  return [...list.filter((x) => x.write.toLowerCase() !== w.toLowerCase()), { write: w, say: s }];
}

let current: Prefs = NARRATOR_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Prefs {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { current = readPrefs(localStorage.getItem(PREFS_KEY)); } catch { /* storage refused: the defaults */ }
  }
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = readPrefs(JSON.stringify({ ...load(), ...patch }));
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(current)); } catch { /* kept for this visit only */ }
  for (const l of listeners) l();
}
export const getPrefs = load;
export function subscribePrefs(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Where the voice was in a book: the passage, and the sentence in it. */
export interface Heard { at: string; seg: number }

function heardAll(): Record<string, Heard> {
  try {
    const all = JSON.parse(localStorage.getItem(HEARD_KEY) ?? "{}");
    return all && typeof all === "object" ? all : {};
  } catch { return {}; }
}
export function getHeard(work: string): Heard | null {
  const h = heardAll()[work];
  return h && typeof h.at === "string" && Number.isInteger(h.seg) && h.seg >= 0 ? h : null;
}
export function saveHeard(work: string, h: Heard) {
  try {
    const all = heardAll();
    delete all[work];
    // the most recent books only, newest last
    const keep = Object.entries(all).slice(-49);
    localStorage.setItem(HEARD_KEY, JSON.stringify(Object.fromEntries([...keep, [work, h]])));
  } catch { /* not kept */ }
}
