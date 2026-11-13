/**
 * The voice: the browser's speech synthesis, one utterance at a time, with the browsers' faults worked round.
 * - Only the latest utterance's events count: a cancelled one's late "end" or "error" is ignored.
 * - Chrome forgets an utterance nobody holds and never says it ended, so the one being said is held here.
 * - Chrome stops its Google voices after about 15 seconds of one utterance; a pause and a resume every 10 seconds keeps them going
 *   (not on Android, where a pause ends the utterance).
 * - Safari can drop an utterance given straight after a cancel, so after a cancel the next waits a moment.
 * - A voice that never starts (a network voice with no network) is reported as "silent" after a few seconds.
 */
import { rankVoices } from "./voices";

export interface SpeakOptions { voice: SpeechSynthesisVoice | null; rate: number; pitch: number }
export interface SpeakEvents {
  onStart?: () => void;
  /** a word begins at `i` in the text given (with its length, where the browser says it) */
  onWord?: (i: number, len: number) => void;
  onEnd: () => void;
  onError: (why: string) => void;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

let token = 0;
let held: SpeechSynthesisUtterance | null = null;
let keepAlive = 0;
let watchdog = 0;
let later = 0;

function clear() {
  clearInterval(keepAlive);
  clearTimeout(watchdog);
  clearTimeout(later);
}

/** Is an utterance being said (or about to be)? */
export const speaking = () => held !== null;

/** Stop the voice now. Nothing said so far reports anything more. */
export function silence() {
  token++;
  clear();
  held = null;
  if (canSpeak() && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}

export function speak(text: string, o: SpeakOptions, ev: SpeakEvents) {
  const wasBusy = canSpeak() && (speechSynthesis.speaking || speechSynthesis.pending);
  silence();
  if (!canSpeak()) { ev.onError("unsupported"); return; }
  const my = token;
  const u = new SpeechSynthesisUtterance(text);
  if (o.voice) { u.voice = o.voice; u.lang = o.voice.lang; } else u.lang = "en";
  u.rate = o.rate;
  u.pitch = o.pitch;
  let started = false;
  u.onstart = () => { if (my !== token) return; started = true; clearTimeout(watchdog); ev.onStart?.(); };
  u.onboundary = (e) => {
    if (my !== token || (e.name && e.name !== "word")) return;
    if (!started) { started = true; clearTimeout(watchdog); }
    ev.onWord?.(e.charIndex, e.charLength ?? 0);
  };
  u.onend = () => { if (my !== token) return; clear(); held = null; ev.onEnd(); };
  u.onerror = (e) => {
    if (my !== token) return;
    clear();
    held = null;
    if (e.error === "interrupted" || e.error === "canceled") return;
    ev.onError(e.error || "error");
  };
  held = u;
  const go = () => {
    if (my !== token) return;
    // (Chrome can be left paused by an earlier pause: it would hold the new utterance too)
    if (speechSynthesis.paused) speechSynthesis.resume();
    speechSynthesis.speak(u);
    const network = !!o.voice && !o.voice.localService;
    watchdog = window.setTimeout(() => { if (my === token && !started) { silence(); ev.onError("silent"); } }, network ? 9000 : 5000);
    // (only Chrome's Google voices stop after 15 seconds; a pause and resume could stutter another voice)
    if (network && /^google/i.test(o.voice!.name) && !/android/i.test(navigator.userAgent)) {
      keepAlive = window.setInterval(() => {
        if (my !== token) return;
        if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); }
      }, 10_000);
    }
  };
  if (wasBusy) later = window.setTimeout(go, 60); else go();
}

/** The device's English voices, best first, kept up to date as the browser loads them (Chrome lists them a moment after the page). */
let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
const voiceListeners = new Set<() => void>();
function readVoices() {
  voices = rankVoices(speechSynthesis.getVoices(), navigator.language);
  for (const l of voiceListeners) l();
}
export function subscribeVoices(l: () => void) {
  voiceListeners.add(l);
  if (canSpeak() && !voicesLoaded) {
    voicesLoaded = true;
    speechSynthesis.addEventListener("voiceschanged", readVoices);
    readVoices();
  }
  return () => { voiceListeners.delete(l); };
}
export const getVoices = () => voices;
const NONE: SpeechSynthesisVoice[] = [];
export const getNoVoices = () => NONE;

/** Wait (at most `ms`) for the browser to list its voices. */
export function voicesReady(ms = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!canSpeak()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) { voices = rankVoices(now, navigator.language); return Promise.resolve(voices); }
  return new Promise((done) => {
    const t = setTimeout(() => done(voices), ms);
    speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); readVoices(); done(voices); }, { once: true });
  });
}
