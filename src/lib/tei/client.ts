/**
 * Main-thread side of the parsing worker. If the worker cannot start (it once failed to, every visit after the
 * first, when the offline helper served its script: the bundler's start-up details travel in the script address's
 * #hash, which a served copy loses), the text is parsed here instead: a little less smooth,
 * but the text always opens.
 */
import type { Placed } from "./align";
import type { TeiDoc } from "./types";
import type { ParseRequest } from "./run";
import type { Scheme } from "./versification";

export interface Parsed { doc: TeiDoc; placed: Placed[] | null; trLevels: string[] | null }

let worker: Worker | null = null;
let broken = false;
let seq = 0;
const waiting = new Map<number, { req: Omit<ParseRequest, "id">; resolve: (p: Parsed) => void; reject: (e: Error) => void }>();

async function here(req: Omit<ParseRequest, "id">): Promise<Parsed> {
  const { runParse } = await import("./run");
  return runParse(req);
}

/** The worker failed: parse everything it was given here instead, and stop using it. */
function giveUp() {
  broken = true;
  worker?.terminate();
  worker = null;
  const pending = [...waiting.values()];
  waiting.clear();
  for (const w of pending) here(w.req).then(w.resolve, w.reject);
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; error?: string } & Parsed>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error));
      else w.resolve({ doc: e.data.doc, placed: e.data.placed, trLevels: e.data.trLevels });
    };
    worker.onerror = (e) => { e.preventDefault(); giveUp(); };
  }
  return worker;
}

export function parseInWorker(grc: string, tr?: string | null, scheme?: Scheme, trUrn?: string): Promise<Parsed> {
  const req = { grc, tr, scheme, trUrn };
  if (broken || typeof Worker === "undefined") return here(req);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { req, resolve, reject });
    try { getWorker().postMessage({ id, ...req } satisfies ParseRequest); }
    catch { giveUp(); }
  });
}
