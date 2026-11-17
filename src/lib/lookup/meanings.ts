/**
 * The meaning list (scripts/build-meanings.mjs): a meaning for the library's dictionary forms that the core vocabulary and LSJ's
 * short definitions leave without one, each a dictionary's own words with the dictionary named: the Middle Liddell, English
 * Wiktionary, or LSJ under the word its entry sends the reader to. It is served by this app (public/meanings), filed under the
 * first two letters of the folded form, as LSJ is.
 */
import { fold } from "@/lib/greek";
import { shardOf } from "./lsj";
import type { WiktSense } from "./wiktionary";

/** under the site's folder when it is served from one (next.config.ts, basePath) */
export const MEANINGS = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/meanings`;

/** "m": the Middle Liddell; "w": Wiktionary; "l": LSJ */
export type ListSource = "m" | "w" | "l";
type Row = { m: string; s: ListSource; v?: string } | { n: [string, ...string[]][] };

/** A meaning from the list: its text, the dictionary it is from, and the word the dictionary gives it under, if another */
export interface ListMeaning { text: string; source: ListSource; under: string | null }
/** What the list has for a word: a meaning, or for a proper name Wiktionary's lines (the card says what the name names) */
export type Listed = { meaning: ListMeaning; name?: undefined } | { meaning?: undefined; name: WiktSense[] };

const shards = new Map<string, Promise<Record<string, Row> | null>>();

function loadShard(shard: string) {
  if (!shards.has(shard)) {
    shards.set(shard, (async () => {
      const res = await fetch(`${MEANINGS}/${encodeURIComponent(shard)}.json`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`meaning list unavailable (${res.status})`);
      return (await res.json()) as Record<string, Row>;
    })().catch((e) => { shards.delete(shard); throw e; }));
  }
  return shards.get(shard)!;
}

const isCapital = (w: string) => /^\p{Lu}/u.test(w);

/** The list's entry for a dictionary form: the exact spelling, else the same letters ignoring accents (a name only finds a name). */
export async function listed(lemma: string): Promise<Listed | null> {
  const h = lemma.normalize("NFC");
  const shard = shardOf(h);
  if (shard === "_") return null;
  const data = await loadShard(shard);
  if (!data) return null;
  const f = fold(h);
  const key = data[h] ? h : Object.keys(data).find((k) => fold(k) === f && isCapital(k) === isCapital(h));
  const row = key ? data[key] : null;
  if (!row) return null;
  if ("n" in row) return { name: row.n.map(([pos, ...lines]) => ({ pos, lines, lemma: null })) };
  return { meaning: { text: row.m, source: row.s, under: row.v ?? null } };
}
