/**
 * The voices the narrator may use: the device's and the browser's English voices, best first. A browser lists every voice it has,
 * good and bad: Edge's "Natural" voices and Safari's "Premium" and "Enhanced" ones sound like a person reading, Chrome's Google
 * voices come next, and the old desktop voices sound like a machine. macOS also lists joke voices (Bubbles, Zarvox), which are left out.
 */

/** What the narrator needs of a voice (SpeechSynthesisVoice has these, and tests can make them). */
export interface VoiceLike { name: string; lang: string; localService: boolean; voiceURI: string; default: boolean }

const JOKES = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical)\b/i;
/** macOS's old voices, which read poorly */
const OLD = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|fred|junior|kathy|ralph)\b/i;

export const isEnglish = (v: VoiceLike) => /^en([-_]|$)/i.test(v.lang);
export const isJoke = (v: VoiceLike) => JOKES.test(v.name);

/** How good a voice is likely to sound, from its name: the higher, the more like a person. */
export function quality(v: VoiceLike): number {
  const n = v.name;
  let q = 0;
  if (/\b(natural|neural)\b/i.test(n)) q += 60;
  if (/\bpremium\b/i.test(n)) q += 55;
  if (/\benhanced\b/i.test(n)) q += 45;
  if (/\bsiri\b/i.test(n)) q += 40;
  if (/^google\b/i.test(n)) q += 35;
  if (/\bonline\b/i.test(n)) q += 10;
  if (/espeak|festival|pico/i.test(n)) q -= 40;
  if (OLD.test(n)) q -= 30;
  return q;
}

/** Natural voices, and the rest. */
export const isNatural = (v: VoiceLike) => quality(v) >= 40;

const ACCENTS: Record<string, string> = {
  GB: "British", US: "American", AU: "Australian", IE: "Irish", IN: "Indian", ZA: "South African", NZ: "New Zealand",
  CA: "Canadian", SG: "Singaporean", HK: "Hong Kong", KE: "Kenyan", NG: "Nigerian", PH: "Filipino", TZ: "Tanzanian",
  GH: "Ghanaian", JM: "Jamaican", PK: "Pakistani", SCOTLAND: "Scottish",
};

/** "British", "American"; "English" where the voice names no country. */
export function accent(lang: string): string {
  const region = lang.split(/[-_]/).slice(1).find((p) => p.length >= 2)?.toUpperCase();
  return (region && ACCENTS[region]) || "English";
}

/** The voice's own name, without the maker and the language the list already shows: "Microsoft Sonia Online (Natural) - English
 * (United Kingdom)" is "Sonia", "Google UK English Female" stays as it is, "Serena (Premium)" is "Serena". */
export function shortName(v: VoiceLike): string {
  let n = v.name.replace(/\s+-\s+English.*$/i, "").replace(/\s*\((natural|premium|enhanced)\)/gi, "").replace(/\bonline\b/i, "");
  n = n.replace(/^Microsoft\s+/i, "").replace(/\s+Desktop$/i, "").replace(/\s{2,}/g, " ").trim();
  return n || v.name;
}

/**
 * The English voices, best first: by quality, then those of the reader's own country (from the browser's language), then the browser's
 * default, then by name. Joke voices are left out.
 */
export function rankVoices<V extends VoiceLike>(voices: V[], userLang = "en-GB"): V[] {
  const mine = userLang.split(/[-_]/)[1]?.toUpperCase();
  const score = (v: V) => quality(v) + (mine && v.lang.toUpperCase().includes(mine) ? 4 : 0) + (v.default ? 2 : 0);
  return voices.filter((v) => isEnglish(v) && !isJoke(v)).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/** The voice to use: the one chosen, if the device still has it; otherwise the best. */
export function pickVoice<V extends VoiceLike>(ranked: V[], chosen: string): V | null {
  return ranked.find((v) => v.voiceURI === chosen) ?? ranked[0] ?? null;
}
