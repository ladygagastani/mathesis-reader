/**
 * The form index (scripts/build-forms.mjs): how GLAUx reads a word form across all its texts. The look-up reads it for a word in
 * a text with no word pack of its own, or a form its pack does not have. It is served by this app (public/forms), filed under the
 * first two letters of the folded form, as LSJ is.
 */
import { lookupForm } from "@/lib/greek";
import { shardOf } from "./lsj";
import { norm, type Analysis } from "./words";

export const FORMS = "/forms";

interface Shard { l: string[]; t: string[]; f: Record<string, number[]> }
const shards = new Map<string, Promise<Shard | null>>();

function loadShard(shard: string): Promise<Shard | null> {
  if (!shards.has(shard)) {
    shards.set(shard, (async () => {
      const res = await fetch(`${FORMS}/${encodeURIComponent(shard)}.json`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`form index unavailable (${res.status})`);
      return (await res.json()) as Shard;
    })().catch((e) => { shards.delete(shard); throw e; }));
  }
  return shards.get(shard)!;
}

const decapitalise = (w: string) => w.charAt(0).toLocaleLowerCase("el") + w.slice(1);

/** The spellings to try, as the text spells the word first: as it stands, without a sentence's capital, with an acute for a grave. */
export function spellings(word: string): string[] {
  const w = norm(word);
  const out: string[] = [];
  for (const s of [w, decapitalise(w), lookupForm(w), decapitalise(lookupForm(w))]) if (s && !out.includes(s)) out.push(s);
  return out;
}

/**
 * How GLAUx usually reads the form, its other readings with how often; null when no text in GLAUx has it. Of the spellings, the
 * one GLAUx meets most often wins: a word capitalised only because it begins a sentence ("Τὴν") is read as the word (τήν), not
 * by the handful of places where GLAUx took the capital for a name.
 */
export async function formReading(word: string): Promise<Analysis | null> {
  let best: Analysis["others"] = [], most = 0;
  for (const s of spellings(word)) {
    const shard = shardOf(s);
    if (shard === "_") return null;
    const data = await loadShard(shard);
    const row = data?.f[s];
    if (!data || !row?.length) continue;
    const readings: Analysis["others"] = [];
    for (let i = 0; i < row.length; i += 3) readings.push({ lemma: data.l[row[i]], tag: data.t[row[i + 1]], n: row[i + 2] });
    const total = readings.reduce((a, r) => a + r.n, 0);
    if (total > most) { best = readings; most = total; }
  }
  return best.length ? { lemma: best[0].lemma, tag: best[0].tag, manual: false, where: "corpus", others: best } : null;
}
