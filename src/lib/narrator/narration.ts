/**
 * The narration: which sentence of which passage the voice is on, and what it does next. It reads the page's English passage by passage,
 * a sentence at a time, marks the sentence and the word being said, and at the end of the page asks for the next page and goes on.
 * The reader (Narrator.tsx) is its host: it says which passages the page has, where their English is, and how to turn the page.
 *
 * A pause stops the voice and remembers the word it had reached; play says the sentence again from that word. (Browsers' own pause
 * and resume are unreliable, above all Chrome's with its network voices.)
 */
import { silence, speak, type SpeakOptions } from "./engine";
import { flatten, mark, markPassage, offsetOf, rangeOf, unmark, type Flat } from "./dom";
import { segments, speakable, wordAt, type SayAs, type Segment } from "./text";

export type Status = "idle" | "playing" | "paused" | "turning" | "done";
/** Stop when this is done: the sentence being said (the sleep timer's end), the passage, the page. */
export type StopAfter = "sentence" | "passage" | "page" | null;

/** A passage of the page that has English, and how many words its English has (for the time left). */
export interface Passage { key: string; words: number }

export interface Host {
  passages(): Passage[];
  /** the passage's English on the page; null while it is not drawn */
  english(key: string): HTMLElement | null;
  /** draw the passage's English (under the Greek, where only the Greek shows) */
  open(key: string): void;
  /** turn to the next page; false at the end of the book */
  nextPage(): boolean;
  options(): SpeakOptions & { gapMs: number; words: boolean; say: SayAs[] };
  /** keep the sentence being said in sight */
  follow(r: Range): void;
  /** the voice has reached this sentence (to be remembered for next time) */
  heard(key: string, seg: number): void;
  /** the voice failed; true if the host has another to try */
  failed(why: string): boolean;
  /** something the player shows has changed */
  changed(): void;
}

export interface View {
  status: Status;
  key: string;
  /** the sentence being read, counted from 0, and the sentences in the passage once it has been read off the page */
  sentence: number;
  count: number;
  /** how far through the page, 0 to 1 */
  progress: number;
  wordsLeft: number;
  stopAfter: StopAfter;
}

interface Built { flat: Flat; segs: Segment[] }

export class Narration {
  private status: Status = "idle";
  private key = "";
  private seg = 0;
  /** where to begin inside the sentence, after a pause (an offset from its start) */
  private from = 0;
  /** the word the voice last reported, as an offset from the sentence's start */
  private lastWord = -1;
  private began = 0;
  private built = new Map<string, Built>();
  /** every jump, pause or new page bumps it, so a late timer or event from before does nothing */
  private gen = 0;
  private timer = 0;
  private tries = 0;
  private stopAfter: StopAfter = null;
  /** play goes on to the next page (it stopped at the end of the last) */
  private turnOnPlay = false;

  constructor(private host: Host) {}

  view(): View {
    const ps = this.host.passages();
    const i = Math.max(0, ps.findIndex((p) => p.key === this.key));
    const total = ps.reduce((n, p) => n + p.words, 0) || 1;
    const b = this.built.get(this.key);
    const before = ps.slice(0, i).reduce((n, p) => n + p.words, 0);
    const within = b && b.segs.length && ps[i] ? (this.seg / b.segs.length) * ps[i].words : 0;
    const done = this.status === "done" ? total : before + within;
    // (a long sentence said in pieces is still one sentence)
    const starts = b ? [...new Set(b.segs.map((x) => x.sentence[0]))] : [];
    const sentence = b?.segs[this.seg] ? starts.indexOf(b.segs[this.seg].sentence[0]) : 0;
    return {
      status: this.status, key: this.key, sentence: Math.max(0, sentence), count: starts.length,
      progress: Math.min(1, done / total), wordsLeft: Math.max(0, Math.round(total - done)), stopAfter: this.stopAfter,
    };
  }

  get playing() { return this.status === "playing" || this.status === "turning"; }

  /** Read from a passage and a sentence (the current place if none is given). */
  play(at?: { key: string; seg?: number; offset?: number }) {
    if (!at && this.status === "done") this.place(this.host.passages()[0]?.key ?? "", 0);
    if (at) this.place(at.key, at.seg ?? 0);
    if (at?.offset !== undefined) {
      const b = this.build(at.key);
      if (b) {
        const k = b.segs.findIndex((s) => at.offset! < s.end);
        this.seg = k < 0 ? Math.max(0, b.segs.length - 1) : k;
      }
    }
    if (!this.key || !this.host.passages().some((p) => p.key === this.key)) this.place(this.host.passages()[0]?.key ?? "", 0);
    if (this.turnOnPlay && !at) {
      this.turnOnPlay = false;
      this.status = "turning";
      this.gen++;
      if (!this.host.nextPage()) this.finish();
      this.host.changed();
      return;
    }
    if (this.stopAfter === "sentence") this.stopAfter = null;
    this.status = "playing";
    this.host.changed();
    this.say();
  }

  /** Read from the point of the page where a click fell, inside a passage's English. */
  playAt(key: string, node: Node, offset: number) {
    const b = this.build(key);
    if (!b) return;
    const at = offsetOf(b.flat, node, offset);
    if (at >= 0) this.play({ key, offset: at });
  }

  pause() {
    if (this.status !== "playing" && this.status !== "turning") return;
    this.gen++;
    clearTimeout(this.timer);
    silence();
    if (this.lastWord >= 0) this.from = this.lastWord;
    this.status = "paused";
    this.host.changed();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  /** Stop and take every mark off the page. */
  stop() {
    this.gen++;
    clearTimeout(this.timer);
    silence();
    unmark();
    markPassage("");
    this.status = "idle";
    this.host.changed();
  }

  /** The sentence before or after. Back, more than a moment into a sentence, goes to its start first. */
  step(dir: 1 | -1) {
    if (dir < 0 && this.status === "playing" && (Date.now() - this.began > 2500 || this.from > 0)) { this.jump(this.key, this.seg); return; }
    const ps = this.host.passages();
    const i = ps.findIndex((p) => p.key === this.key);
    const b = this.build(this.key);
    if (dir > 0) {
      if (b && this.seg + 1 < b.segs.length) this.jump(this.key, this.seg + 1);
      else if (ps[i + 1]) this.jump(ps[i + 1].key, 0);
      else if (this.playing) { this.gen++; silence(); this.endOfPage(); }
    } else if (this.seg > 0) this.jump(this.key, this.seg - 1);
    else if (i > 0) {
      const prev = ps[i - 1].key;
      const pb = this.build(prev);
      // (its English may not be drawn yet; then its first sentence)
      this.jump(prev, pb ? Math.max(0, pb.segs.length - 1) : 0);
    }
  }

  /** The passage before or after. Back, inside a passage, goes to its start first. */
  passage(dir: 1 | -1) {
    const ps = this.host.passages();
    const i = ps.findIndex((p) => p.key === this.key);
    if (dir < 0 && (this.seg > 0 || this.from > 0)) { this.jump(this.key, 0); return; }
    const to = ps[i + dir];
    if (to) this.jump(to.key, 0);
    else if (dir > 0 && this.playing) { this.gen++; silence(); this.endOfPage(); }
  }

  /** To the passage at this share of the page's words (a click on the player's progress line). */
  seek(share: number) {
    const ps = this.host.passages();
    const total = ps.reduce((n, p) => n + p.words, 0);
    let acc = 0;
    for (const p of ps) {
      if (acc + p.words > share * total) { this.jump(p.key, 0); return; }
      acc += p.words;
    }
    if (ps.length) this.jump(ps[ps.length - 1].key, 0);
  }

  /** Say the sentence again from the word reached (the voice, its speed or its pronunciations have changed). */
  again() {
    if (this.status !== "playing") return;
    if (this.lastWord >= 0) this.from = this.lastWord;
    this.say();
  }

  /** The page has changed (turned by the narration or by the reader): start at its first passage with English. */
  newPage() {
    this.built.clear();
    this.gen++;
    clearTimeout(this.timer);
    const first = this.host.passages()[0]?.key ?? "";
    this.place(first, 0);
    this.turnOnPlay = false;
    if (this.status === "turning" || this.status === "playing") { this.status = "playing"; this.say(); }
    else { unmark(); markPassage(this.status === "paused" ? first : ""); this.host.changed(); }
  }

  /** The page was drawn again (columns changed, an English opened): what was read off it is out of date. */
  redrawn() {
    this.built.clear();
    if (this.status === "playing") this.again();
    else if (this.status === "paused") this.show();
  }

  setStopAfter(s: StopAfter) { this.stopAfter = s; this.host.changed(); }

  // ---------------------------------------------------------------- inside

  private place(key: string, seg: number) {
    this.key = key;
    this.seg = seg;
    this.from = 0;
    this.lastWord = -1;
  }

  private jump(key: string, seg: number) {
    this.gen++;
    clearTimeout(this.timer);
    this.place(key, seg);
    this.turnOnPlay = false;
    if (this.status === "playing" || this.status === "turning") { this.status = "playing"; this.say(); }
    else { if (this.status !== "paused") this.status = "paused"; silence(); this.show(); }
  }

  /** The passage's English read off the page, cut into what the voice says (kept until the page is drawn again). */
  private build(key: string): Built | null {
    const el = this.host.english(key);
    const had = this.built.get(key);
    if (had && el && had.flat.root === el && el.isConnected) return had;
    if (!el) return null;
    const flat = flatten(el);
    const b = { flat, segs: segments(flat.text) };
    this.built.set(key, b);
    return b;
  }

  /** Mark the sentence (and keep it in sight) without saying it. */
  private show(): Built | null {
    if (!this.key) { this.host.changed(); return null; }
    this.host.open(this.key);
    const b = this.build(this.key);
    markPassage(this.key);
    if (!b || !b.segs.length) { unmark(); this.host.changed(); return b; }
    this.seg = Math.min(this.seg, b.segs.length - 1);
    const s = b.segs[this.seg];
    const r = rangeOf(b.flat, s.sentence[0], s.sentence[1]);
    mark(r, null);
    if (r) this.host.follow(r);
    this.host.changed();
    return b;
  }

  private say() {
    const g = ++this.gen;
    clearTimeout(this.timer);
    silence();
    const ps = this.host.passages();
    if (!ps.length) { this.endOfPage(); return; }
    if (!ps.some((p) => p.key === this.key)) this.place(ps[0].key, 0);
    this.host.open(this.key);
    const b = this.build(this.key);
    if (!b) {
      // the English is being drawn under the Greek: try again in a moment, for two seconds or so. (A timer, not the next frame: a
      // browser draws no frames in a tab out of sight, and the reader may be listening from another tab.)
      if (this.tries++ < 40) { this.timer = window.setTimeout(() => { if (g === this.gen) this.say(); }, 50); this.host.changed(); return; }
      this.tries = 0;
      this.nextPassage(g);
      return;
    }
    this.tries = 0;
    if (!b.segs.length || this.seg >= b.segs.length) { this.nextPassage(g); return; }
    this.show();
    const s = b.segs[this.seg];
    const base = Math.min(s.start + this.from, s.end);
    const o = this.host.options();
    const { spoken, from, to } = speakable(b.flat.text.slice(base, s.end), o.say);
    if (!spoken.trim()) { this.next(g); return; }
    this.host.heard(this.key, this.seg);
    this.began = Date.now();
    speak(spoken, o, {
      onWord: (i, len) => {
        if (g !== this.gen) return;
        const w = wordAt(spoken, from, to, i, len);
        if (!w) return;
        this.lastWord = base - s.start + w[0];
        if (o.words) mark(rangeOf(b.flat, s.sentence[0], s.sentence[1]), rangeOf(b.flat, base + w[0], base + w[1]));
      },
      onEnd: () => { if (g === this.gen) this.next(g); },
      onError: (why) => {
        if (g !== this.gen) return;
        if (this.host.failed(why)) { this.say(); return; }
        this.status = "paused";
        this.host.changed();
      },
    });
  }

  /** The sentence is said: the next, or the next passage. */
  private next(g: number) {
    this.from = 0;
    this.lastWord = -1;
    if (this.stopAfter === "sentence") { this.stopAfter = null; this.advanceThenPause(); return; }
    const b = this.built.get(this.key);
    if (b && this.seg + 1 < b.segs.length) { this.seg++; this.say(); return; }
    this.nextPassage(g);
  }

  private nextPassage(g: number) {
    const ps = this.host.passages();
    const i = ps.findIndex((p) => p.key === this.key);
    if (this.stopAfter === "passage") { this.stopAfter = null; this.advanceThenPause(); return; }
    if (i >= 0 && ps[i + 1]) {
      this.place(ps[i + 1].key, 0);
      const wait = this.host.options().gapMs;
      if (wait) {
        unmark();
        this.host.changed();
        this.timer = window.setTimeout(() => { if (g === this.gen) this.say(); }, wait);
      } else this.say();
      return;
    }
    this.endOfPage();
  }

  /** Stop, with the place moved on to what comes next, so play goes on from there. */
  private advanceThenPause() {
    this.gen++;
    silence();
    const ps = this.host.passages();
    const i = ps.findIndex((p) => p.key === this.key);
    const b = this.built.get(this.key);
    if (b && this.seg + 1 < b.segs.length) this.seg++;
    else if (ps[i + 1]) this.place(ps[i + 1].key, 0);
    else this.turnOnPlay = true;
    this.status = "paused";
    this.show();
  }

  private endOfPage() {
    if (this.stopAfter === "page" || this.stopAfter === "passage") {
      this.stopAfter = null;
      this.turnOnPlay = true;
      this.status = "paused";
      this.host.changed();
      return;
    }
    this.status = "turning";
    unmark();
    this.host.changed();
    if (!this.host.nextPage()) this.finish();
  }

  private finish() {
    this.status = "done";
    unmark();
    markPassage("");
    this.host.changed();
  }
}
