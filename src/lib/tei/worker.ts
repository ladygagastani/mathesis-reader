/// <reference lib="webworker" />
/** Parses TEI off the main thread so the page stays smooth, even for large texts. */
import { runParse, type ParseRequest } from "./run";

export type { ParseRequest };

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { id, ...req } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, ...runParse(req) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error).message });
  }
};
