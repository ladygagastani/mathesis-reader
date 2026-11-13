/**
 * The narrator as the device's media: the book on the lock screen and in the system's media controls, and the play, pause, next and
 * previous keys of a keyboard or of headphones. A browser gives these only to a page that is playing sound, and speech synthesis does
 * not count, so while the voice reads, a second of silence plays over and over.
 */
export interface MediaHandlers { play: () => void; pause: () => void; next: () => void; previous: () => void; forward: () => void; back: () => void }

let audio: HTMLAudioElement | null = null;

/** One second of silence as a WAV file: 8000 samples a second, 8 bits, one channel. */
function silentWav(): string {
  const n = 8000;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, n, true);
  b.fill(128, 44);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return `data:audio/wav;base64,${btoa(s)}`;
}

const session = () => (typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null);

export function mediaOn(h: MediaHandlers) {
  const ms = session();
  if (!ms) return;
  if (!audio) {
    audio = new Audio(silentWav());
    audio.loop = true;
    audio.setAttribute("data-narrator-audio", "");
  }
  const set = (a: MediaSessionAction, f: () => void) => { try { ms.setActionHandler(a, f); } catch { /* an action this browser lacks */ } };
  set("play", h.play);
  set("pause", h.pause);
  set("stop", h.pause);
  set("nexttrack", h.next);
  set("previoustrack", h.previous);
  set("seekforward", h.forward);
  set("seekbackward", h.back);
}

/** What the system shows: the book, its author, the passage. */
export function mediaInfo(title: string, author: string, passage: string) {
  const ms = session();
  if (!ms || typeof MediaMetadata === "undefined") return;
  ms.metadata = new MediaMetadata({ title: passage ? `${title}, ${passage}` : title, artist: author, album: "Mathesis Reader" });
}

export function mediaPlaying(playing: boolean) {
  const ms = session();
  if (!ms || !audio) return;
  ms.playbackState = playing ? "playing" : "paused";
  if (playing) audio.play().catch(() => { /* not allowed yet: the controls on the page still work */ });
  else audio.pause();
}

export function mediaOff() {
  const ms = session();
  audio?.pause();
  if (!ms) return;
  ms.playbackState = "none";
  ms.metadata = null;
  for (const a of ["play", "pause", "stop", "nexttrack", "previoustrack", "seekforward", "seekbackward"] as MediaSessionAction[]) {
    try { ms.setActionHandler(a, null); } catch { /* an action this browser lacks */ }
  }
}
