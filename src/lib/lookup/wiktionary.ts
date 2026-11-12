/**
 * Live look-up in English Wiktionary (CC BY-SA 4.0). Wiktionary lists every possible analysis
 * of a form out of context; we show them all rather than guess. Only the word is sent.
 */

export interface WiktSense { pos: string; lines: string[]; lemma: string | null }
export interface WiktResult { title: string; senses: WiktSense[]; lemmaSenses: WiktSense[] | null; url: string }

const API = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const cache = new Map<string, Promise<WiktSense[] | null>>();

/** Wiktionary's HTML → plain lines; also finds the "of <lemma>" link in form-of entries. */
function clean(html: string): { text: string; lemma: string | null } {
  const lemma = /\bof\s*(?:<[^>]+>\s*)*<a[^>]*title="([^"]+)"/.exec(html)?.[1] ?? null;
  const text = html
    // Wiktionary inlines its own stylesheets in some definitions: drop them with their contents, not only their tags
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").trim();
  return { text, lemma: lemma?.replace(/#.*$/, "") ?? null };
}

async function fetchSenses(title: string, signal?: AbortSignal): Promise<WiktSense[] | null> {
  if (!cache.has(title)) {
    cache.set(title, (async () => {
      const res = await fetch(API + encodeURIComponent(title) + "?redirect=true", { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Wiktionary answered ${res.status}`);
      const data = (await res.json()) as Record<string, { language: string; partOfSpeech: string; definitions: { definition: string }[] }[]>;
      const senses: WiktSense[] = [];
      for (const list of Object.values(data)) for (const e of list) {
        if (e.language !== "Ancient Greek") continue;
        const defs = e.definitions.map((d) => clean(d.definition)).filter((d) => d.text);
        if (!defs.length) continue;
        senses.push({
          pos: e.partOfSpeech,
          lines: [...new Set(defs.flatMap((d) => d.text.split(/\n+/).map((s) => s.trim()).filter(Boolean)))],
          lemma: defs.find((d) => d.lemma)?.lemma ?? null,
        });
      }
      return senses.length ? senses : null;
    })().catch((e) => { cache.delete(title); throw e; }));
  }
  return cache.get(title)!;
}

/** Look up a form; if Wiktionary says it is a form of another word, fetch that word too. */
export async function lookUpWiktionary(forms: string[], signal?: AbortSignal): Promise<WiktResult | null> {
  for (const title of forms) {
    const senses = await fetchSenses(title, signal);
    if (!senses) continue;
    const lemma = senses.find((s) => s.lemma && s.lemma !== title)?.lemma ?? null;
    const lemmaSenses = lemma ? await fetchSenses(lemma, signal).catch(() => null) : null;
    return { title, senses, lemmaSenses, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(title)}#Ancient_Greek` };
  }
  return null;
}
