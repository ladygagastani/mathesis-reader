/**
 * A text's XML, from GitHub, pinned to the exact version of the collection the catalogue names, so a copy never goes out
 * of date and the browser's own cache can keep it. Texts read in this visit are kept in memory.
 */
import { rawUrl, type CatalogIndex, type CatText } from "@/lib/catalog";

export class TextUnavailable extends Error {}

const memory = new Map<string, Promise<string>>();
const KEEP = 12;

export function getXml(idx: CatalogIndex, t: CatText): Promise<string> {
  const hit = memory.get(t.urn);
  if (hit) return hit;
  const p = fetchXml(rawUrl(idx, t)).catch((e) => { memory.delete(t.urn); throw e; });
  if (memory.size >= KEEP) memory.delete(memory.keys().next().value!);
  memory.set(t.urn, p);
  return p;
}

async function fetchXml(url: string): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new TextUnavailable("You are offline, and this text needs a connection.");
  }
  let res: Response;
  try { res = await fetch(url); }
  catch { throw new TextUnavailable("GitHub could not be reached. Check your connection and try again."); }
  if (!res.ok) throw new TextUnavailable(`GitHub answered ${res.status} for this text.`);
  return res.text();
}
