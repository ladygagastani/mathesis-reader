"use client";
/**
 * The narrator: the book's English read aloud, passage by passage, by the best English voice the device has. A player stands at the
 * foot of the text column while it reads: back and on by a sentence or a passage, play and pause, where the voice is, how long the
 * page has left, and the voice's settings. The sentence being said is marked on the page and kept in sight; each word too, where the
 * voice says where its words are. A click on the English reads from there. At the end of a page it turns the page and reads on.
 * With only the Greek showing, each passage's English opens under its Greek as the voice reaches it.
 * The keys (while it is open): l plays and pauses, [ and ] go a sentence back and on, { and } a passage. The device's media keys work too.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Columns } from "@/lib/settings";
import type { Row } from "@/lib/tei/align";
import type { Block } from "@/lib/tei/types";
import { caretAt, unmark } from "@/lib/narrator/dom";
import { canSpeak, getNoVoices, getVoices, speak, subscribeVoices, voicesReady } from "@/lib/narrator/engine";
import { mediaInfo, mediaOff, mediaOn, mediaPlaying } from "@/lib/narrator/media";
import { Narration, type StopAfter, type View } from "@/lib/narrator/narration";
import {
  addSayAs, GAPS, getHeard, getPrefs, NARRATOR_DEFAULTS, PITCHES, RATES, saveHeard, setPrefs, subscribePrefs, type Gap, type Prefs,
} from "@/lib/narrator/prefs";
import { duration, minutesFor, wordCount } from "@/lib/narrator/text";
import { accent, isNatural, pickVoice, shortName } from "@/lib/narrator/voices";
import Icon from "@/components/Icon";
import styles from "./Narrator.module.css";

/** Where to begin: a passage, and a point in its English (a click), or nothing (where you are reading). n changes with every asking. */
export interface ListenFrom { key?: string; node?: Node; offset?: number; n: number }

const englishOf = (blocks: Block[]) => blocks.map((b) => b.c.map((x) => (typeof x === "string" ? x : "")).join(" ")).join(" ");

const SLEEP: [string, string][] = [["off", "Never"], ["passage", "After this passage"], ["page", "At the end of the page"], ["15", "In 15 minutes"], ["30", "In 30 minutes"], ["60", "In an hour"]];
const GAP_NAMES: [Gap, string][] = [["none", "None"], ["short", "A breath"], ["long", "A pause"]];
const SAMPLE = "This is how I will read the English to you.";

function useFollowing(prefs: Prefs) {
  // the reader scrolled away from the voice: the page stops following it until "Back to the voice"
  const [lost, setLost] = useState(false);
  const last = useRef<Range | null>(null);
  const scrollTo = useCallback((r: Range, force: boolean) => {
    const box = r.getClientRects()[0] ?? r.getBoundingClientRect();
    if (!box || (!box.width && !box.height)) return;
    const bar = document.querySelector("[data-reader-bar]")?.getBoundingClientRect().bottom ?? 0;
    const foot = document.querySelector("[data-narrator]")?.getBoundingClientRect().top ?? innerHeight;
    const room = 24;
    if (!force && box.top >= bar + room && box.bottom <= foot - room) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: scrollY + box.top - (bar + (foot - bar) * 0.28), behavior: reduce ? "auto" : "smooth" });
  }, []);
  const follow = useCallback((r: Range) => {
    last.current = r;
    if (prefs.follow && !lost) scrollTo(r, false);
  }, [prefs.follow, lost, scrollTo]);
  const back = () => { setLost(false); if (last.current) scrollTo(last.current, true); };
  return { lost, setLost, follow, back };
}

/** Listen on a phone: the bar has no room for it there, so it stands at the foot of the screen, where a thumb reaches (shown by CSS only
 * on a narrow window; the bar's Listen serves a wider one). */
export function ListenButton({ onListen }: { onListen: () => void }) {
  return (
    <button type="button" className={`btn ${styles.listenFoot}`} onClick={onListen}>
      <Icon name="listen" />Listen
    </button>
  );
}

export default function Narrator({ work, title, author, rows, cols, pageKey, hasNext, onNextPage, open, from, onClose }: {
  work: string; title: string; author: string;
  /** the page's passages */
  rows: Row[]; cols: Columns; pageKey: string;
  hasNext: boolean; onNextPage: () => void;
  /** opens a passage's English under its Greek */
  open: (key: string) => void;
  from: ListenFrom | null;
  onClose: () => void;
}) {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, () => NARRATOR_DEFAULTS);
  const voices = useSyncExternalStore(subscribeVoices, getVoices, getNoVoices);
  const [view, setView] = useState<View | null>(null);
  const [leaf, setLeaf] = useState(false);
  const [note, setNote] = useState("");
  // a voice taken in place of the chosen one, which failed (for this visit only)
  const [stand, setStand] = useState<SpeechSynthesisVoice | null>(null);
  const { lost, setLost, follow, back } = useFollowing(prefs);

  const passages = useMemo(
    () => rows.filter((r) => r.trans.length && (cols !== "greek" || r.greek.length)).map((r) => ({ key: r.key, words: wordCount(englishOf(r.trans)) })),
    [rows, cols],
  );
  const voice = stand ?? pickVoice(voices, prefs.voice);

  // what the narration asks of the page, always from this render's values
  const live = useRef({ passages, prefs, voice, cols, hasNext, onNextPage, open, follow, work, title, author });
  useEffect(() => { live.current = { passages, prefs, voice, cols, hasNext, onNextPage, open, follow, work, title, author }; });

  // made the first time it is needed (in an effect or a handler, never while drawing)
  const nar = useRef<Narration | null>(null);
  const narration = useCallback((): Narration => {
    if (nar.current) return nar.current;
    const made: Narration = new Narration({
    passages: () => live.current.passages,
    english: (key) => document.getElementById(`p-${key}`)?.querySelector<HTMLElement>("[data-reading]") ?? null,
    open: (key) => { if (live.current.cols === "greek") live.current.open(key); },
    nextPage: () => { if (!live.current.hasNext) return false; live.current.onNextPage(); return true; },
    options: () => {
      const p = live.current.prefs;
      return { voice: live.current.voice as SpeechSynthesisVoice | null, rate: p.rate, pitch: p.pitch, gapMs: GAPS[p.gap], words: p.words, say: p.say };
    },
    follow: (r) => live.current.follow(r),
    heard: (key, seg) => { saveHeard(live.current.work, { at: key, seg }); mediaInfo(live.current.title, live.current.author, key); },
    failed: (why) => {
      const now = live.current.voice;
      const local = getVoices().find((v) => v.localService && v !== now);
      if (now && !now.localService && local) {
        setStand(local);
        live.current.voice = local;
        setNote(`${shortName(now)} did not answer, so ${shortName(local)}, a voice on this device, reads instead.`);
        return true;
      }
      setNote(why === "not-allowed" ? "The browser would not let the voice start. Press play to try again." : "The voice could not be started. Try another in the voice's settings.");
      return false;
    },
    changed: () => setView(made.view()),
    });
    nar.current = made;
    return made;
  }, []);

  // the first start: from the place asked for, or where the voice stopped last time if that is in sight, or the first passage in sight
  // (on the page: React may mount, unmount and mount it again at once in development, and a voice must never start once it is gone)
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const started = useRef(0);
  useEffect(() => {
    if (!from || started.current === from.n) return;
    started.current = from.n;
    const again = () => { started.current = 0; };
    if (from.key && from.node) { narration().playAt(from.key, from.node, from.offset ?? 0); return again; }
    if (from.key) { narration().play({ key: from.key }); return again; }
    voicesReady().then(() => {
      if (!mounted.current) return;
      const ps = live.current.passages;
      const bar = document.querySelector("[data-reader-bar]")?.getBoundingClientRect().bottom ?? 0;
      const inSight = (key: string) => { const r = document.getElementById(`p-${key}`)?.getBoundingClientRect(); return !!r && r.bottom > bar + 8 && r.top < innerHeight; };
      const heard = getHeard(work);
      if (heard && ps.some((p) => p.key === heard.at) && inSight(heard.at)) narration().play({ key: heard.at, seg: heard.seg });
      else narration().play({ key: ps.find((p) => inSight(p.key))?.key ?? ps[0]?.key ?? "" });
    });
    // (unmounted and mounted again: start again)
    return again;
  }, [from, narration, work]);

  // a new page (turned by the narration, or by the reader): the narration starts at its top
  const lastPage = useRef(pageKey);
  const lastRows = useRef(rows);
  useEffect(() => {
    if (lastPage.current === pageKey && lastRows.current === rows) return;
    lastPage.current = pageKey;
    lastRows.current = rows;
    setLost(false);
    // (after the page is drawn; a timer, as a tab out of sight draws no frames)
    const f = window.setTimeout(() => narration().newPage(), 30);
    return () => clearTimeout(f);
  }, [pageKey, rows, narration, setLost]);

  // the columns changed: the English stands elsewhere on the page
  const lastCols = useRef(cols);
  useEffect(() => {
    if (lastCols.current === cols) return;
    lastCols.current = cols;
    // (after the page is drawn; a timer, as a tab out of sight draws no frames)
    const f = window.setTimeout(() => narration().redrawn(), 30);
    return () => clearTimeout(f);
  }, [cols, narration]);

  // the voice, its speed, its pitch or its pronunciations changed: the sentence again, from the word it had reached
  const sound = `${voice?.voiceURI}|${prefs.rate}|${prefs.pitch}|${JSON.stringify(prefs.say)}`;
  const lastSound = useRef(sound);
  useEffect(() => {
    if (lastSound.current === sound) return;
    lastSound.current = sound;
    narration().again();
  }, [sound, narration]);

  // gone: silent, and no marks left on the page
  useEffect(() => () => { narration().stop(); unmark(); mediaOff(); }, [narration]);

  // the device's media keys and lock screen
  useEffect(() => {
    mediaOn({
      play: () => narration().play(), pause: () => narration().pause(), next: () => narration().passage(1), previous: () => narration().passage(-1),
      forward: () => narration().step(1), back: () => narration().step(-1),
    });
  }, [narration]);
  const playing = view?.status === "playing" || view?.status === "turning";
  useEffect(() => { mediaPlaying(playing); }, [playing]);

  // the reader scrolling the page away from the voice
  useEffect(() => {
    if (!playing || !prefs.follow) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent && !["PageUp", "PageDown", "Home", "End", " ", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      if (e instanceof KeyboardEvent && (e.target as HTMLElement).closest?.("input, textarea, select, [role=dialog], [data-u]")) return;
      // (a press on the page's scrollbar lands on <html> itself)
      if (e.type === "pointerdown" && e.target !== document.documentElement) return;
      if ((e.target as HTMLElement).closest?.("[data-narrator], [data-lookup]")) return;
      setLost(true);
    };
    addEventListener("wheel", away, { passive: true });
    addEventListener("touchmove", away, { passive: true });
    addEventListener("keydown", away);
    addEventListener("pointerdown", away);
    return () => {
      removeEventListener("wheel", away); removeEventListener("touchmove", away); removeEventListener("keydown", away); removeEventListener("pointerdown", away);
    };
  }, [playing, prefs.follow, setLost]);

  // a click on the English reads from there
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const english = t.closest?.("main [data-reading]");
      if (!english || t.closest("button, a, sup, input, [data-silent], [lang='grc']")) return;
      const sel = getSelection();
      if (sel && !sel.isCollapsed) return;
      const key = english.closest("section[id^='p-']")?.id.slice(2);
      const at = caretAt(e.clientX, e.clientY);
      if (!key || !at) return;
      setLost(false);
      narration().playAt(key, at.node, at.offset);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [narration, setLost]);

  // the keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (t.closest?.("[role=dialog]") && !t.closest("[data-narrator]")) return;
      const k = e.key;
      if (k === "l") narration().toggle();
      else if (k === "]") narration().step(1);
      else if (k === "[") narration().step(-1);
      else if (k === "}") narration().passage(1);
      else if (k === "{") narration().passage(-1);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [narration]);

  // the sleep timer
  const [sleep, setSleep] = useState<{ kind: string; until: number }>({ kind: "off", until: 0 });
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!sleep.until) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= sleep.until) { narration().setStopAfter("sentence"); setSleep({ kind: "off", until: 0 }); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleep.until, narration]);
  // the narration lets go of a stop it has made
  const stopAfter: StopAfter = view?.stopAfter ?? null;
  const sleepKind = sleep.until ? sleep.kind : stopAfter === "passage" ? "passage" : stopAfter === "page" ? "page" : "off";
  const chooseSleep = (kind: string) => {
    if (kind === "passage" || kind === "page") { setSleep({ kind: "off", until: 0 }); narration().setStopAfter(kind); return; }
    narration().setStopAfter(null);
    setSleep(kind === "off" ? { kind, until: 0 } : { kind, until: Date.now() + Number(kind) * 60_000 });
  };

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 9000); return () => clearTimeout(t); }, [note]);

  const status = view?.status ?? "idle";
  const minutesLeft = minutesFor(view?.wordsLeft ?? 0, prefs.rate);
  const line = note || (
    status === "turning" ? "Turning the page…"
      : status === "done" ? "The end of the book."
      : status === "paused" ? "Paused"
      : status === "idle" ? "Finding a voice…"
      : <>{duration(minutesLeft)} left<span className={styles.wideText}> on this page</span></>
  );
  const stopLine = sleep.until ? `Stops in ${duration(Math.max(0, Math.ceil((sleep.until - now) / 60_000)))}`
    : stopAfter === "passage" ? "Stops after this passage" : stopAfter === "page" ? "Stops at the end of the page" : "";

  if (!canSpeak()) {
    return (
      <section className={styles.player} aria-label="Narrator" data-narrator="">
        <div className={styles.bar}>
          <p className={styles.none}>This browser cannot read aloud. Edge, Chrome and Safari can.</p>
          <button type="button" className="icon-btn" onClick={onClose}><Icon name="close" label="Close the narrator" /></button>
        </div>
      </section>
    );
  }

  const onTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setLost(false);
    narration().seek((e.clientX - r.left) / r.width);
  };

  return (
    <section className={styles.player} aria-label="Narrator" data-narrator="" data-status={status}>
      <div className={styles.track} onClick={onTrack} title="Go to a passage of this page" aria-hidden="true">
        <span className={styles.done} style={{ "--p": view?.progress ?? 0 } as React.CSSProperties} />
      </div>
      <div className={styles.bar}>
        <div className={styles.transport}>
          <button type="button" className={`icon-btn ${styles.wide}`} onClick={() => narration().passage(-1)} title="The passage before ({)">
            <Icon name="passage-back" label="The passage before" />
          </button>
          <button type="button" className="icon-btn" onClick={() => narration().step(-1)} title="The sentence before ([)">
            <Icon name="chevron-left" label="The sentence before" />
          </button>
          <button type="button" className={`btn ${styles.play}`} onClick={() => narration().toggle()} aria-pressed={playing} title={playing ? "Pause (l)" : "Read on (l)"}>
            <Icon name={playing ? "pause" : "play"} label={playing ? "Pause" : "Read on"} />
          </button>
          <button type="button" className="icon-btn" onClick={() => narration().step(1)} title="The sentence after (])">
            <Icon name="chevron-right" label="The sentence after" />
          </button>
          <button type="button" className={`icon-btn ${styles.wide}`} onClick={() => narration().passage(1)} title="The passage after (})">
            <Icon name="passage-next" label="The passage after" />
          </button>
        </div>

        <div className={styles.now}>
          <p className={styles.where}>
            {view?.key ? <><span className={styles.passage}>{view.key}</span>{view.count > 0 && <span className={styles.of}><span className={styles.wideText}>sentence </span>{view.sentence + 1} of {view.count}</span>}</> : <span className={styles.of}>{title}</span>}
          </p>
          <p className={styles.status} aria-live="polite">
            {line}{stopLine && <span className={styles.stop}><Icon name="timer" />{stopLine}</span>}
          </p>
        </div>

        <div className={styles.tools}>
          {lost && prefs.follow && (
            <button type="button" className={`btn ghost ${styles.follow}`} onClick={back}><Icon name="follow" /><span className={styles.wideText}>Back to the voice</span></button>
          )}
          <button type="button" className={`btn quiet ${styles.speed} ${styles.wide}`} onClick={() => setLeaf((x) => !x)} aria-expanded={leaf} title="Speed and voice">
            {prefs.rate.toFixed(2).replace(/0$/, "")}×
          </button>
          <button type="button" className="icon-btn" data-menu-opener="" onClick={() => setLeaf((x) => !x)} aria-expanded={leaf} aria-haspopup="dialog">
            <Icon name="voice" label="The voice's settings" />
          </button>
          <button type="button" className="icon-btn" onClick={onClose}><Icon name="close" label="Stop and close the narrator" /></button>
        </div>
      </div>

      {leaf && (
        <Settings prefs={prefs} voices={voices} voice={voice} playing={playing} sleep={sleepKind} onSleep={chooseSleep}
          onVoice={(uri) => { setStand(null); setPrefs({ voice: uri }); }} onClose={() => setLeaf(false)} />
      )}
    </section>
  );
}

function Settings({ prefs, voices, voice, playing, sleep, onSleep, onVoice, onClose }: {
  prefs: Prefs; voices: SpeechSynthesisVoice[]; voice: SpeechSynthesisVoice | null; playing: boolean;
  sleep: string; onSleep: (k: string) => void; onVoice: (uri: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [write, setWrite] = useState("");
  const [say, setSay] = useState("");
  useEffect(() => {
    ref.current?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.("[data-narrator]")) onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);
  const natural = voices.filter(isNatural), others = voices.filter((v) => !isNatural(v));
  const label = (v: SpeechSynthesisVoice) => `${shortName(v)} · ${accent(v.lang)}`;
  const hear = (text: string) => speak(text, { voice, rate: prefs.rate, pitch: prefs.pitch }, { onEnd: () => {}, onError: () => {} });

  return (
    <div ref={ref} role="dialog" aria-labelledby={id} tabIndex={-1} className={styles.leaf}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>Listening</h2>
        <button type="button" className="icon-btn" onClick={onClose}><Icon name="close" label="Close the voice's settings" /></button>
      </div>
      <div className={styles.leafBody}>

      <div className={styles.field}>
        <label className="label" htmlFor={`${id}-voice`}>Voice</label>
        {voices.length ? (
          <>
            <select id={`${id}-voice`} className={styles.select} value={voice?.voiceURI ?? ""} onChange={(e) => onVoice(e.target.value)}>
              {natural.length > 0 && <optgroup label="Natural voices">{natural.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}</optgroup>}
              {others.length > 0 && <optgroup label={natural.length ? "Other voices" : "Voices"}>{others.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}</optgroup>}
            </select>
            <p className={styles.hint}>
              {voice && <>{isNatural(voice) ? "A natural voice" : "A standard voice"}, {voice.localService ? "on this device" : "from the browser, online"}. </>}
              {!natural.length && "Edge on Windows, and Safari with a Premium voice installed, have voices that sound like a person reading. "}
              {!playing && <button type="button" className="text-btn" onClick={() => hear(SAMPLE)}>Hear it</button>}
            </p>
          </>
        ) : <p className={styles.hint}>This device has no English voice yet. It may still be loading them.</p>}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className="label" htmlFor={`${id}-rate`}>Speed</label>
          <span className={styles.value}>{prefs.rate.toFixed(2).replace(/0$/, "")}× · about {Math.round(165 * prefs.rate)} words a minute</span>
        </div>
        <input id={`${id}-rate`} type="range" className={styles.range} min={RATES.min} max={RATES.max} step={RATES.step} value={prefs.rate}
          onChange={(e) => setPrefs({ rate: Number(e.target.value) })} />
        <div className={styles.presets} role="group" aria-label="Speeds">
          {[0.8, 1, 1.25, 1.5, 2].map((r) => (
            <button key={r} type="button" className={styles.preset} aria-pressed={prefs.rate === r} onClick={() => setPrefs({ rate: r })}>{r}×</button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className="label" htmlFor={`${id}-pitch`}>Pitch</label>
          <span className={styles.value}>
            {prefs.pitch === 1 ? "the voice's own" : prefs.pitch < 1 ? "lower" : "higher"}
            {prefs.pitch !== 1 && <> · <button type="button" className="text-btn" onClick={() => setPrefs({ pitch: 1 })}>its own</button></>}
          </span>
        </div>
        <input id={`${id}-pitch`} type="range" className={styles.range} min={PITCHES.min} max={PITCHES.max} step={PITCHES.step} value={prefs.pitch}
          onChange={(e) => setPrefs({ pitch: Number(e.target.value) })} />
      </div>

      <div className={styles.field}>
        <span className="label" id={`${id}-gap`}>Between passages</span>
        <div className="segmented" role="radiogroup" aria-labelledby={`${id}-gap`}>
          {GAP_NAMES.map(([g, name]) => <button key={g} type="button" role="radio" aria-checked={prefs.gap === g} onClick={() => setPrefs({ gap: g })}>{name}</button>)}
        </div>
      </div>

      <div className={styles.field}>
        <span className="label" id={`${id}-sleep`}>Stop reading</span>
        <div className={styles.choices} role="radiogroup" aria-labelledby={`${id}-sleep`}>
          {SLEEP.map(([k, name]) => <button key={k} type="button" role="radio" aria-checked={sleep === k} onClick={() => onSleep(k)}>{name}</button>)}
        </div>
      </div>

      <div className={styles.field}>
        <span className="label">As it reads</span>
        <label className={styles.check}>
          <input type="checkbox" checked={prefs.follow} onChange={(e) => setPrefs({ follow: e.target.checked })} />
          <span>Keep the sentence in sight<span className={styles.hint}>The page scrolls with the voice. Scroll away and it waits until you come back.</span></span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={prefs.words} onChange={(e) => setPrefs({ words: e.target.checked })} />
          <span>Mark each word as it is said<span className={styles.hint}>Some voices do not say where each word falls; with those, the sentence is marked.</span></span>
        </label>
      </div>

      <div className={styles.field}>
        <span className="label" id={`${id}-say`}>Names said your way</span>
        <p className={styles.hint}>Where the voice says a name wrongly, write it as it sounds. The voice uses it in every book.</p>
        {prefs.say.length > 0 && (
          <ul className={styles.sayList} aria-labelledby={`${id}-say`}>
            {prefs.say.map((x) => (
              <li key={x.write} className={styles.sayRow}>
                <span className={styles.sayWrite}>{x.write}</span>
                <Icon name="next" />
                <span className={styles.saySay}>{x.say}</span>
                <button type="button" className="text-btn" onClick={() => hear(x.say)}>Hear</button>
                <button type="button" className="icon-btn" onClick={() => setPrefs({ say: prefs.say.filter((y) => y !== x) })}>
                  <Icon name="close" label={`Forget how to say ${x.write}`} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className={styles.sayForm} onSubmit={(e) => {
          e.preventDefault();
          setPrefs({ say: addSayAs(prefs.say, write, say) });
          setWrite(""); setSay("");
        }}>
          <input aria-label="The name as written" placeholder="Achaeans" value={write} onChange={(e) => setWrite(e.target.value)} autoComplete="off" spellCheck={false} />
          <input aria-label="How to say it" placeholder="a-kee-ans" value={say} onChange={(e) => setSay(e.target.value)} autoComplete="off" spellCheck={false} />
          <button type="button" className="text-btn" disabled={!say.trim()} onClick={() => hear(say)}>Hear</button>
          <button type="submit" className="btn ghost" disabled={!write.trim() || !say.trim()}>Add</button>
        </form>
      </div>
      </div>
    </div>
  );
}
