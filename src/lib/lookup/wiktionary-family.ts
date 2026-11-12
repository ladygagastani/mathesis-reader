/**
 * A word's family from English Wiktionary (CC BY-SA 4.0), live: where it comes from (etymology),
 * the Greek words built on it ("Derived terms", "Related terms"), and the English words that
 * descend from it, as Wiktionary's editors list them under "Descendants". Only the word is sent.
 *
 * Read from the rendered page (the REST "page/html" endpoint), so Wiktionary's own templates have
 * already been turned into text. Runs in the browser (DOMParser).
 */

export interface WordFamily {
  title: string;
  etymology: string[];
  derived: string[];
  related: string[];
  english: string[];
  url: string;
}

const API = "https://en.wiktionary.org/api/rest_v1/page/html/";
const cache = new Map<string, Promise<WordFamily | null>>();

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "(").trim();

/** The text of an element without footnote markers, styles or nested lists. */
function textOf(el: Element, dropLists = false): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll("sup.reference, style, link, .mw-empty-elt" + (dropLists ? ", ul, ol, dl" : "")).forEach((x) => x.remove());
  return clean(c.textContent ?? "");
}

/** Letters of a script other than Latin and Greek: the site's three typefaces cannot draw them (DESIGN.md, "Type"). */
const OTHER = /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Common}\p{Script=Inherited}]+/u;
const OTHER_ALL = new RegExp(OTHER.source, "gu");

/**
 * An etymology line as the site can draw it: a cognate in another script followed by its transliteration ("Sanskrit वेद (véda)")
 * keeps the transliteration ("Sanskrit véda"); anything else in another script is left out, and the punctuation around it tidied.
 */
export function drawable(line: string): string {
  if (!OTHER.test(line)) return line;
  return line
    .replace(new RegExp(String.raw`${OTHER.source}\s*\(([^()]+)\)`, "gu"), "$1")
    .replace(OTHER_ALL, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/,(\s*,)+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * A Greek word as the text spells it: without the marks of a long or short vowel (the macron and breve, as in ῐ̓́σμεν) that
 * Wiktionary adds for learners. With them a letter can carry three marks, which no typeface of the three draws as one.
 */
export const plainGreek = (w: string) => w.normalize("NFD").replace(/[\u0304\u0306]/g, "").normalize("NFC");

const heading = (s: Element) => s.querySelector(":scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6")?.textContent?.trim() ?? "";

export function parseFamily(html: string, title: string): WordFamily | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.getElementById("Ancient_Greek")?.closest("section");
  if (!root) return null;
  const fam: WordFamily = { title, etymology: [], derived: [], related: [], english: [], url: `https://en.wiktionary.org/wiki/${encodeURIComponent(title)}#Ancient_Greek` };
  const add = (list: string[], v: string) => { if (v && !list.includes(v)) list.push(v); };
  for (const s of root.querySelectorAll("section")) {
    const h = heading(s);
    const own = [...s.children];
    if (/^Etymology/.test(h)) {
      for (const p of own.filter((x) => x.tagName === "P")) { const t = plainGreek(drawable(textOf(p))); if (t) add(fam.etymology, t); }
    } else if (/^(Derived terms|Related terms)/.test(h)) {
      const list = h.startsWith("Derived") ? fam.derived : fam.related;
      s.querySelectorAll('[lang="grc"]').forEach((x) => add(list, plainGreek(clean(x.textContent ?? ""))));
    } else if (/^Descendants/.test(h)) {
      for (const li of s.querySelectorAll("li")) {
        const c = li.cloneNode(true) as Element;
        c.querySelectorAll("ul, ol").forEach((x) => x.remove());
        if (!/(^|\s|→)English:/.test(c.textContent ?? "")) continue;
        c.querySelectorAll('[lang="en"]').forEach((x) => add(fam.english, clean(x.textContent ?? "")));
      }
    }
  }
  return fam;
}

export function wordFamily(title: string, signal?: AbortSignal): Promise<WordFamily | null> {
  const t = title.normalize("NFC");
  if (!cache.has(t)) {
    cache.set(t, (async () => {
      const res = await fetch(API + encodeURIComponent(t), { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Wiktionary answered ${res.status}`);
      return parseFamily(await res.text(), t);
    })().catch((e) => { cache.delete(t); throw e; }));
  }
  return cache.get(t)!;
}
