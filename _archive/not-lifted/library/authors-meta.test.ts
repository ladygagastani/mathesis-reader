import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ERAS, centuryOfYear, eraOfYear, kindsOf, lifeSpan, placingYear, type AuthorMeta } from "./authors-meta";
import type { Catalog } from "./catalog";

describe("periods", () => {
  it("tile the timeline with no gap or overlap", () => {
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].from, ERAS[i].name).toBe(ERAS[i - 1].to + 1);
  });
  it("place well-known years where the usual conventions do", () => {
    expect(eraOfYear(-750).id).toBe("archaic");
    expect(eraOfYear(-480).id).toBe("archaic");
    expect(eraOfYear(-479).id).toBe("classical");
    expect(eraOfYear(-323).id).toBe("classical");
    expect(eraOfYear(-322).id).toBe("hellenistic");
    expect(eraOfYear(100).id).toBe("imperial");
    expect(eraOfYear(400).id).toBe("lateantique");
    expect(eraOfYear(900).id).toBe("byzantine");
  });
});

describe("centuries", () => {
  it("count BC and AD centuries the usual way", () => {
    expect(centuryOfYear(-500)).toBe("5th c. BC");
    expect(centuryOfYear(-499)).toBe("5th c. BC");
    expect(centuryOfYear(-400)).toBe("4th c. BC");
    expect(centuryOfYear(-401)).toBe("5th c. BC");
    expect(centuryOfYear(1)).toBe("1st c. AD");
    expect(centuryOfYear(100)).toBe("1st c. AD");
    expect(centuryOfYear(101)).toBe("2nd c. AD");
    expect(centuryOfYear(311)).toBe("4th c. AD");
  });
  it("write the span of a life", () => {
    expect(lifeSpan({ q: "Q1", birth: [-496, 9], death: [-406, 9] })).toBe("5th c. BC");
    expect(lifeSpan({ q: "Q1", birth: [-484, 9], death: [-425, 9] })).toBe("5th c. BC");
    expect(lifeSpan({ q: "Q1", birth: [-429, 11], death: [-347, 9] })).toBe("5th–4th c. BC");
    expect(lifeSpan({ q: "Q1", birth: [-20, 9], death: [50, 9] })).toBe("1st c. BC – 1st c. AD");
    expect(lifeSpan(undefined)).toBeNull();
  });
});

describe("placing an author", () => {
  const m = (o: Partial<AuthorMeta>): AuthorMeta => ({ q: "Q1", ...o });
  it("uses the middle of the adult life, so Aeschylus is Classical and Aristotle too", () => {
    expect(eraOfYear(placingYear(m({ birth: [-525, 9], death: [-456, 9] }), [])!.year).id).toBe("classical");
    expect(eraOfYear(placingYear(m({ birth: [-384, 9], death: [-322, 9] }), [])!.year).id).toBe("classical");
    expect(eraOfYear(placingYear(m({ birth: [-496, 9], death: [-406, 9] }), [])!.year).id).toBe("classical");
  });
  it("prefers a floruit, then one date, then GLAUx's span, else nothing", () => {
    expect(placingYear(m({ flor: [-800, 7], birth: [-900, 7] }), [])).toEqual({ year: -800, from: "wikidata" });
    expect(placingYear(m({ death: [120, 9] }), [])).toEqual({ year: 120, from: "wikidata" });
    expect(placingYear(undefined, [{ genre: null, dialect: null, from: -500, to: -301, tokens: 1 }])).toEqual({ year: -400, from: "glaux" });
    expect(placingYear(undefined, [])).toBeNull();
  });
});

describe("kinds of writing", () => {
  it("come from GLAUx's classification when there is one, not from Wikidata's looser occupations", () => {
    const sophocles = m({ occ: ["philosopher", "playwright"] });
    expect(kindsOf(sophocles, [{ genre: "Tragedy", dialect: null, from: null, to: null, tokens: null }])).toEqual(["Drama"]);
  });
  it("fall back to occupations when GLAUx has nothing", () => {
    expect(kindsOf(m({ occ: ["historian"] }), [])).toEqual(["History and biography"]);
    expect(kindsOf(m({ occ: ["writer"] }), [])).toEqual([]);
  });
  function m(o: Partial<AuthorMeta>): AuthorMeta { return { q: "Q1", ...o }; }
});

describe("the Wikidata file", () => {
  const cat = JSON.parse(readFileSync("public/data/catalog.json", "utf8")) as Catalog;
  const file = JSON.parse(readFileSync("public/data/authors-meta.json", "utf8")) as { authors: Record<string, AuthorMeta> };
  const ids = new Set(cat.authors.map((a) => a.id));
  it("describes only authors that are in the catalogue, and most of them", () => {
    for (const id of Object.keys(file.authors)) expect(ids.has(id), id).toBe(true);
    expect(Object.keys(file.authors).length).toBeGreaterThan(250);
  });
  it("gives plausible years, birth before death", () => {
    for (const [id, a] of Object.entries(file.authors)) {
      for (const k of ["birth", "death", "flor"] as const) if (a[k]) expect(Math.abs(a[k]![0]), `${id} ${k}`).toBeLessThan(2500);
      // century and decade values (precision 7 and 8) are only a label, so compare exact years alone
      if (a.birth && a.death && a.birth[1] >= 9 && a.death[1] >= 9) expect(a.birth[0], id).toBeLessThanOrEqual(a.death[0]);
    }
  });
  it("puts a few authors we know where they belong", () => {
    const era = (id: string) => eraOfYear(placingYear(file.authors[id], [])!.year).id;
    expect(era("tlg0012")).toBe("archaic");       // Homer
    expect(era("tlg0016")).toBe("classical");     // Herodotus
    expect(era("tlg0059")).toBe("classical");     // Plato
    expect(era("tlg0007")).toBe("imperial");      // Plutarch
    expect(era("tlg0562")).toBe("imperial");      // Marcus Aurelius
  });
});
