import { describe, expect, it } from "vitest";
import type { CatAuthor, CatText, CatWork } from "@/lib/catalog";
import { beginnings, bestShelf, byKind, byLetter, byPeriod, byTitle, shelves } from "./catalogue";

// a few real entries of the catalogue, cut down to what the list reads
const text = (urn: string, kind: CatText["kind"], lang: string, label: string | null = null) => ({ urn, kind, lang, label }) as CatText;
const work = (id: string, title: string, english: boolean, label: string | null = null, greek = true): CatWork => ({
  id, title, lang: "grc",
  texts: [...(greek ? [text(`urn:cts:greekLit:${id}.perseus-grc2`, "edition", "grc", label)] : []), ...(english ? [text(`urn:cts:greekLit:${id}.perseus-eng2`, "translation", "eng")] : [])],
});
const plato: CatAuthor = { id: "tlg0059", name: "Plato", works: [work("tlg0059.tlg002", "Apology", true, "Ἀπολογία Σωκράτους"), work("tlg0059.tlg011", "Symposium", true), work("tlg0059.tlg036", "Letters", false)] };
const pseudo: CatAuthor = { id: "x1", name: "Pseudo-Plato", works: [work("x1.w1", "Axiochus", false)] };
const homer: CatAuthor = { id: "tlg0012", name: "Homer", works: [work("tlg0012.tlg001", "Iliad", true), work("tlg0012.tlg002", "Odyssey", true), work("tlg0012.tlg099", "No Greek", true, null, false)] };
const authors = [plato, homer, pseudo];
const names = { tlg0059: { grc: "Πλάτων", also: ["Platon"] }, tlg0012: { grc: "Ὅμηρος" } };
const titles = (ss: ReturnType<typeof shelves>) => ss.map((s) => `${s.author.name}: ${s.works.map((w) => w.title).join(", ")}`);

describe("the library's search", () => {
  it("lists every author A to Z, with only the works that have a Greek text", () => {
    expect(titles(shelves(authors, names, "", "all"))).toEqual(["Homer: Iliad, Odyssey", "Plato: Apology, Letters, Symposium", "Pseudo-Plato: Axiochus"]);
  });

  it("keeps all the works of an author it names, in English, in Greek, or by another name, accents aside", () => {
    expect(titles(shelves(authors, names, "homer", "all"))).toEqual(["Homer: Iliad, Odyssey"]);
    expect(titles(shelves(authors, names, "ομηρος", "all"))).toEqual(["Homer: Iliad, Odyssey"]);
    expect(titles(shelves(authors, names, "Platon", "all"))).toEqual(["Plato: Apology, Letters, Symposium"]);
  });

  it("finds a work by its English title or its Greek one", () => {
    expect(titles(shelves(authors, names, "symp", "all"))).toEqual(["Plato: Symposium"]);
    expect(titles(shelves(authors, names, "ἀπολογία", "all"))).toEqual(["Plato: Apology"]);
  });

  it("keeps only the works with English, or only those without", () => {
    expect(titles(shelves(authors, names, "plato", "english"))).toEqual(["Plato: Apology, Symposium"]);
    expect(titles(shelves(authors, names, "plato", "greek"))).toEqual(["Plato: Letters", "Pseudo-Plato: Axiochus"]);
  });

  it("puts the author a search plainly names first, and no one when it names several equally", () => {
    const found = shelves(authors, names, "plato", "all");
    expect(bestShelf(found, names, "plato")?.author.name).toBe("Plato");
    expect(bestShelf(found, names, "")).toBeNull();
    expect(bestShelf(shelves(authors, names, "o", "all"), names, "o")).toBeNull();
  });
});

describe("the catalogue's order", () => {
  it("sets authors by kind of writing, in the catalogue's order, with a count of works", () => {
    const kinds = new Map([["tlg0012.tlg001", "Epic"], ["tlg0012.tlg002", "Epic"], ["tlg0059.tlg002", "Philosophy"], ["tlg0059.tlg011", "Philosophy"], ["tlg0059.tlg036", "Letters"]]);
    const parts = byKind(shelves(authors, names, "", "all"), kinds);
    expect(parts.map((p) => `${p.label} ${p.works}`)).toEqual(["Epic 2", "Philosophy 2", "Letters 1", "Other writings 1"]);
    expect(parts[2].shelves[0].author.name).toBe("Plato");
  });

  it("or as one list of authors under each letter", () => {
    expect(byLetter(shelves(authors, names, "", "all")).map((p) => `${p.label}: ${p.shelves.map((s) => s.author.name).join(", ")}`)).toEqual(["H: Homer", "P: Plato, Pseudo-Plato"]);
  });
});

describe("the other orders and the filters", () => {
  const all = shelves(authors, names, "", "all");
  it("keeps only the works the filters keep", () => {
    expect(titles(shelves(authors, names, "", "all", (w) => w.id.startsWith("tlg0012")))).toEqual(["Homer: Iliad, Odyssey"]);
  });
  it("lists the titles A to Z, each with its author", () => {
    const parts = byTitle(all);
    expect(parts.map((p) => p.key)).toEqual(["A", "I", "L", "O", "S"]);
    expect(parts[0].rows.map((r) => `${r.work.title} (${r.author.name})`)).toEqual(["Apology (Plato)", "Axiochus (Pseudo-Plato)"]);
  });
  it("groups by period, earliest first, then the works not dated", () => {
    const meta = { "tlg0012.tlg001": { genre: null, from: -800 }, "tlg0012.tlg002": { genre: null, from: -800 }, "tlg0059.tlg002": { genre: null, from: -400 } };
    expect(byPeriod(all, meta).map((p) => `${p.label}: ${p.works}`)).toEqual(["Archaic · 8th–6th c. BC: 2", "Classical · 5th–4th c. BC: 1", "Not dated: 3"]);
  });
  it("begins with the works with English whose words are most familiar, one to an author", () => {
    const diff: Record<string, [number, number]> = { "tlg0059.tlg002": [9000, 830], "tlg0059.tlg011": [12000, 810], "tlg0012.tlg001": [120000, 760], "tlg0059.tlg036": [9000, 900], "x1.w1": [3000, 950] };
    expect(beginnings(all, diff).map((b) => `${b.work.title} ${b.pct}`)).toEqual(["Apology 83", "Iliad 76"]);
  });
});
