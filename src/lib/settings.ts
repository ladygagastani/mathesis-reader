/**
 * The reader's settings, kept on this device: Paper or Night, the size of the Greek, and the columns. They are written onto <html>
 * (data-theme, --greek-chosen) by `apply`, and by BOOT_SCRIPT before the first paint, so a page never shows the wrong paper first.
 * Paper or Night follows the device unless one is chosen (ADR 0008, decision 2). The Greek's size is the one that suits the device
 * (--greek-auto in tokens.css) until one is chosen. A book opens on the Greek alone (ADR 0009, decision 2).
 */
export type Theme = "auto" | "paper" | "night";
export type Columns = "greek" | "both" | "trans";
/** rem, or "auto": the size that suits the device */
export type GreekSize = "auto" | number;
export interface Settings { theme: Theme; greekSize: GreekSize; columns: Columns }

export const DEFAULTS: Settings = { theme: "auto", greekSize: "auto", columns: "greek" };
export const GREEK_SIZES = { min: 1, max: 2, step: 0.125 } as const;
export const STORAGE_KEY = "mathesis-reader:settings";
const THEME_COLOUR = "#f4eee3";
const THEME_COLOUR_NIGHT = "#191612";

const THEMES: readonly Theme[] = ["auto", "paper", "night"];
const COLUMNS: readonly Columns[] = ["greek", "both", "trans"];

/** Whatever was stored, made into good settings: anything unknown or out of range falls back to the default. */
export function readSettings(raw: string | null): Settings {
  let p: Partial<Record<keyof Settings, unknown>> = {};
  try { p = (JSON.parse(raw ?? "{}") as typeof p) ?? {}; } catch { /* a damaged value: the defaults */ }
  const size = p.greekSize;
  return {
    theme: THEMES.includes(p.theme as Theme) ? (p.theme as Theme) : DEFAULTS.theme,
    columns: COLUMNS.includes(p.columns as Columns) ? (p.columns as Columns) : DEFAULTS.columns,
    greekSize: typeof size === "number" && size >= GREEK_SIZES.min && size <= GREEK_SIZES.max ? size : "auto",
  };
}

/** One step larger (+1) or smaller (-1) than `now`; from "auto", the step nearest the size the page shows (`shownRem`). */
export function stepSize(now: GreekSize, dir: 1 | -1, shownRem: number): number {
  const { min, max, step } = GREEK_SIZES;
  const from = now === "auto" ? Math.round(shownRem / step) * step : now;
  return Math.min(max, Math.max(min, from + dir * step));
}

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Settings {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { current = readSettings(localStorage.getItem(STORAGE_KEY)); } catch { /* storage refused: the defaults */ }
  }
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = readSettings(JSON.stringify({ ...load(), ...patch }));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* kept for this visit only */ }
  apply(current);
  for (const l of listeners) l();
}

/** For the hook in use-settings.ts: be told of every change. */
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getSettings = load;

export function apply(s: Settings, el: HTMLElement = document.documentElement) {
  if (s.theme === "auto") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", s.theme);
  if (typeof s.greekSize === "number") el.style.setProperty("--greek-chosen", `${s.greekSize}rem`);
  else el.style.removeProperty("--greek-chosen");
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = s.theme === "night" || (s.theme === "auto" && m.media.includes("dark")) ? THEME_COLOUR_NIGHT : THEME_COLOUR;
  });
}

/** The same as `apply`, run in <head> before the page is drawn. */
export const BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}")||{},e=document.documentElement;
if(s.theme==="paper"||s.theme==="night"){e.setAttribute("data-theme",s.theme);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=s.theme==="night"?"${THEME_COLOUR_NIGHT}":"${THEME_COLOUR}"})}
if(typeof s.greekSize==="number"&&s.greekSize>=${GREEK_SIZES.min}&&s.greekSize<=${GREEK_SIZES.max})e.style.setProperty("--greek-chosen",s.greekSize+"rem")}catch(_){}})();`;

export const THEME_COLOURS = { paper: THEME_COLOUR, night: THEME_COLOUR_NIGHT } as const;
