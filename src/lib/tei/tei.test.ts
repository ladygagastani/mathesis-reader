import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTei } from "./parse";
import { translationPieces, placePieces, alignChunk, mendBreaks } from "./align";
import type { Block, TeiDoc } from "./types";

const load = (f: string) => readFileSync(`test-fixtures/${f}.xml`, "utf8");
const doc = (f: string) => parseTei(load(f));

const blockText = (b: Block) =>
  (("speaker" in b && b.speaker) || "") + b.c.map((x) => (typeof x === "string" ? x : "note" in x ? x.note : "")).join("");
const docText = (d: TeiDoc) => d.units.flatMap((u) => u.blocks.map(blockText)).join("");
const plain = (b: Block[]) => b.map(blockText).join(" ");

/** Every letter of printed text in the file's <body>, in order (tags, and <reg> metadata, removed). */
function bodyLetters(xml: string, re: RegExp) {
  const body = xml.slice(xml.indexOf("<body"), xml.lastIndexOf("</body>")).replace(/<reg\b[^>]*>[\s\S]*?<\/reg>/g, "");
  const text = body.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return (text.match(re) ?? []).join("");
}
const GREEK = /[Ͱ-Ͽἀ-῿]/gu;
const LATIN = /[A-Za-z]/g;

describe("TEI parsing keeps the text exactly", () => {
  for (const [f, re] of [
    ["tlg0012.tlg001.perseus-grc2", GREEK], ["tlg0059.tlg002.perseus-grc2", GREEK], ["tlg0011.tlg002.perseus-grc2", GREEK],
    ["tlg0031.tlg004.perseus-grc2", GREEK], ["tlg0555.tlg001.1st1K-grc1", GREEK],
    ["tlg0012.tlg001.perseus-eng3", LATIN], ["tlg0059.tlg002.perseus-eng2", LATIN], ["tlg0011.tlg002.perseus-eng2", LATIN],
    ["tlg0016.tlg001.perseus-eng2", LATIN],
  ] as const) {
    it(`loses and changes no letter: ${f}`, () => {
      const xml = load(f);
      const got = (docText(parseTei(xml)).match(re) ?? []).join("");
      expect(got).toBe(bodyLetters(xml, re));
    });
  }
});

describe("citation schemes", () => {
  it("Iliad: book and line, one page per book", () => {
    const d = doc("tlg0012.tlg001.perseus-grc2");
    expect(d.levels).toEqual(["book", "line"]);
    expect(d.chunks).toHaveLength(24);
    expect(d.chunks[0].label).toBe("Book 1");
    expect(d.units[0].ref).toEqual(["1", "1"]);
    expect(plain(d.units[0].blocks)).toBe("μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος");
  });
  it("Gospel of John: chapter and verse", () => {
    const d = doc("tlg0031.tlg004.perseus-grc2");
    expect(d.levels).toEqual(["chapter", "verse"]);
    expect(plain(d.units[1].blocks)).toBe("Οὗτος ἦν ἐν ἀρχῇ πρὸς τὸν θεόν.");
  });
  it("Antigone: lines with speakers, pages by scene", () => {
    const d = doc("tlg0011.tlg002.perseus-grc2");
    expect(d.levels).toEqual(["line"]);
    const first = d.units[0].blocks[0];
    expect(first.t === "l" && first.speaker).toBe("Ἀντιγόνη");
    expect(d.chunks.length).toBeGreaterThan(5);
  });
  it("Apology: Stephanus sections", () => {
    const d = doc("tlg0059.tlg002.perseus-grc2");
    expect(d.levels).toEqual(["section"]);
    expect(d.units.map((u) => u.ref[0]).slice(0, 3)).toEqual(["17", "18", "19"]);
  });
});

describe("alignment with the translation", () => {
  const rowsFor = (g: string, t: string, chunk = 0) => {
    const grc = doc(g), tr = doc(t);
    const placed = placePieces(grc, translationPieces(grc, tr));
    return { rows: alignChunk(grc, grc.chunks[chunk], placed), placed, tr };
  };

  it("never drops or duplicates translation text", () => {
    for (const [g, t] of [["tlg0012.tlg001.perseus-grc2", "tlg0012.tlg001.perseus-eng3"], ["tlg0011.tlg002.perseus-grc2", "tlg0011.tlg002.perseus-eng2"], ["tlg0059.tlg002.perseus-grc2", "tlg0059.tlg002.perseus-eng2"]]) {
      const { placed, tr } = rowsFor(g, t);
      const placedText = (placed.flatMap((p) => p.blocks).map(blockText).join("").match(LATIN) ?? []).join("");
      expect(placedText, t).toBe((docText(tr).match(LATIN) ?? []).join(""));
    }
  });

  it("Iliad: Murray's line markers anchor the English to Greek lines", () => {
    const { rows } = rowsFor("tlg0012.tlg001.perseus-grc2", "tlg0012.tlg001.perseus-eng3");
    expect(rows[0].key).toBe("1.1");
    expect(plain(rows[0].trans)).toMatch(/^The wrath sing, goddess/);
    expect(rows[0].greek.length).toBeLessThan(8);
    expect(rows.every((r) => r.greek.every((u) => u.ref[0] === "1"))).toBe(true);
  });

  it("Antigone: English line blocks sit beside the matching Greek lines", () => {
    const { rows } = rowsFor("tlg0011.tlg002.perseus-grc2", "tlg0011.tlg002.perseus-eng2");
    expect(rows[0].greek.map((u) => u.ref[0])).toEqual(["1", "2", "3", "4"]);
    expect(plain(rows[0].trans)).toMatch(/Ismene, my sister/);
  });

  it("Apology: section by section", () => {
    const { rows } = rowsFor("tlg0059.tlg002.perseus-grc2", "tlg0059.tlg002.perseus-eng2");
    expect(rows[0].key).toBe("17");
    expect(plain(rows[0].trans)).toMatch(/How you, men of Athens/);
  });
});

import { findRef } from "./refs";
describe("going to a reference", () => {
  it("finds exact references, prefixes and Stephanus sections", () => {
    const il = doc("tlg0012.tlg001.perseus-grc2");
    expect(il.units[findRef(il, "1.33")].ref).toEqual(["1", "33"]);
    expect(il.units[findRef(il, "2")].ref).toEqual(["2", "1"]);
    expect(il.units[findRef(il, "3 15")].ref).toEqual(["3", "15"]);
    const ap = doc("tlg0059.tlg002.perseus-grc2");
    expect(ap.units[findRef(ap, "19a")].ref).toEqual(["19"]);
    expect(findRef(il, "99.1")).toBe(-1);
  });
});

describe("unusual headers", () => {
  it("reads citation patterns whose quotes are escaped with backslashes (Hesiod's Theogony)", () => {
    const xml = `<TEI><teiHeader><encodingDesc><refsDecl n="CTS">
      <cRefPattern n="line" matchPattern="(\\w+)" replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div//tei:l[@n=\'$1\'])"/>
      </refsDecl></encodingDesc></teiHeader><text><body><div type="edition">
      <l n="1">Μουσάων Ἑλικωνιάδων ἀρχώμεθʼ ἀείδειν,</l><l n="2">αἵθʼ Ἑλικῶνος ἔχουσιν ὄρος μέγα τε ζάθεόν τε</l>
      </div></body></text></TEI>`;
    const d = parseTei(xml);
    expect(d.levels).toEqual(["line"]);
    expect(d.units.map((u) => u.ref)).toEqual([["1"], ["2"]]);
  });
});

describe("metadata inside the text", () => {
  it("does not show Perseus gazetteer data as if it were translation (Godley's Herodotus)", () => {
    const d = doc("tlg0016.tlg001.perseus-eng2");
    const text = d.units.slice(0, 2).flatMap((u) => u.blocks.map(blockText)).join(" ");
    expect(text).toContain("the inquiry of Herodotus of Halicarnassus");
    expect(text).not.toContain("Bodrum");
  });
});

// ------------------------------------------------------------ translations that number or divide differently
import { untranslated } from "./align";
import { renumber, schemeFor } from "./versification";

/** a two-level text (chapter.verse) from a list like { "1": ["1","2"], "2": ["1"] } */
const tei = (chapters: Record<string, string[]>, word = "w") => parseTei(`<TEI><text><body><div type="edition">${
  Object.entries(chapters).map(([c, vs]) => `<div type="textpart" subtype="chapter" n="${c}">${vs.map((v) => `<div type="textpart" subtype="verse" n="${v}"><p>${word} ${c}.${v}</p></div>`).join("")}</div>`).join("")
}</div></body></text></TEI>`);
const rowsOf = (g: TeiDoc, t: TeiDoc) => g.chunks.flatMap((c) => alignChunk(g, c, placePieces(g, translationPieces(g, t))));

describe("translations that divide or number differently", () => {
  it("takes the innermost numbered divs when the pattern is //div[@n] (Andocides' English)", () => {
    const xml = `<TEI><teiHeader><encodingDesc><refsDecl n="CTS">
      <cRefPattern n="section" matchPattern="(\w+)" replacementPattern="#xpath(/tei:TEI/tei:text/tei:body//tei:div//tei:div[@n='$1'])"/>
      </refsDecl></encodingDesc></teiHeader><text><body><div type="translation">
      <div n="Intro"><div n="1"><p>one</p></div><div n="2"><p>two</p></div></div>
      <div n="Narrative"><div n="3"><p>three</p></div></div>
      </div></body></text></TEI>`;
    expect(parseTei(xml).units.map((u) => u.ref.join("."))).toEqual(["1", "2", "3"]);
  });

  it("marks Greek the translation leaves out, and English running on from the page before", () => {
    // English has chapter 1 only: chapter 2's Greek is not translated (one page per chapter)
    const rows = rowsOf(tei({ 1: ["1", "2"], 2: ["1", "2"] }), tei({ 1: ["1", "2"] }, "e"));
    expect(untranslated(rows).map((r) => r.key)).toEqual(["2.1"]);
    // inside a page: verse 3 of chapter 1 has no English of its own and stays with verse 2's English
    const one = rowsOf(tei({ 1: ["1", "2", "3"] }), tei({ 1: ["1", "2"] }, "e"));
    expect(one.map((r) => [r.key, r.greek.length])).toEqual([["1.1", 1], ["1.2", 2]]);
    expect(untranslated(one)).toEqual([]);
  });

  it("puts English whose paragraphs are numbered differently into its own division, in order (Hippocrates' Epidemics)", () => {
    const g = tei({ 1: ["1", "2"], 2: ["3", "4", "5", "6"] }), e = tei({ 1: ["1", "2"], 2: ["1", "2"] }, "e");
    const placed = placePieces(g, translationPieces(g, e));
    expect(placed.map((p) => g.units[p.at].ref.join("."))).toEqual(["1.1", "1.2", "2.3", "2.6"]);
  });

  it("matches references written slightly differently (Euclid's def_1 and def1)", () => {
    const g = tei({ def1: ["1"] }), e = tei({ def_1: ["1"] }, "e");
    expect(placePieces(g, translationPieces(g, e))[0].extra).toBeUndefined();
  });

  it("notes English the Greek edition has no place for (an edition of Mark 1 beside all of Mark)", () => {
    const g = tei({ 1: ["1", "2"] }), e = tei({ 1: ["1", "2"], 2: ["1"] }, "e");
    const placed = placePieces(g, translationPieces(g, e));
    expect(placed.map((p) => !!p.extra)).toEqual([false, false, true]);
    expect(rowsOf(g, e).some((r) => r.extra)).toBe(true);
  });

  it("lines up the Septuagint Psalms with an English Bible numbered like the Hebrew", () => {
    // Greek 9 = Hebrew 9 + 10; Greek 10 = Hebrew 11, with its heading as verse 1
    const g = tei({ 9: ["1", "2", "3", "4"], 10: ["1", "2", "3"] });
    const e = tei({ 9: ["1", "2"], 10: ["1"], 11: ["1", "2"] }, "e");
    expect(schemeFor("tlg0527.tlg027", { urn: "x", desc: "World English Bible. Revision of the American Standard Version" })).toBe("lxx-psalms-hebrew");
    const placed = placePieces(g, translationPieces(g, renumber("lxx-psalms-hebrew", g, e)));
    // Greek 9 has 4 verses and the English 3 (9.1, 9.2, 10.1): the heading is verse 1, the English first verse stands beside it
    expect(placed.map((p) => `${plain(p.blocks)}→${g.units[p.at].ref.join(".")}`)).toEqual(["e 9.1→9.1", "e 9.2→9.3", "e 10.1→9.4", "e 11.1→10.1", "e 11.2→10.3"]);
  });
});

describe("numbers that match only by coincidence", () => {
  it("spreads a division numbered from a different start even where some numbers coincide (Epidemics 1.2: English 1–6, Greek 4–12)", () => {
    const g = tei({ 1: ["1"], 2: ["4", "5", "6", "7", "8", "9", "10", "11", "12"] }), e = tei({ 1: ["1"], 2: ["1", "2", "3", "4", "5", "6"] }, "e");
    const at = placePieces(g, translationPieces(g, e)).map((p) => g.units[p.at].ref.join("."));
    expect(at[1]).toBe("2.4");          // the first English paragraph at the first Greek one
    expect(at[6]).toBe("2.12");         // the last with the last, not "2.6" by its number
  });
});

describe("pages", () => {
  // a made-up text in the shape of Aristotle's On the Soul: books of long prose chapters
  const prose = (books: number, chapters: number, letters: number) => `<TEI><teiHeader><encodingDesc><refsDecl n="CTS">
    <cRefPattern n="chapter" replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']/tei:div[@n='$2'])"/>
    <cRefPattern n="book" replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1'])"/></refsDecl></encodingDesc></teiHeader>
    <text><body><div type="edition">${Array.from({ length: books }, (_, b) => `<div type="textpart" subtype="book" n="${b + 1}">${
      Array.from({ length: chapters }, (_, c) => `<div type="textpart" subtype="chapter" n="${c + 1}"><p>${"α".repeat(letters)}</p></div>`).join("")}</div>`).join("")}</div></body></text></TEI>`;
  it("a long book of prose is cut into runs of its chapters, named by chapter", () => {
    const d = parseTei(prose(2, 12, 4000));
    expect(d.levels).toEqual(["book", "chapter"]);
    expect(d.chunks.length).toBeGreaterThan(2);
    expect(d.chunks[0].label).toBe("Book 1, chapters 1–4");
    // every passage is on exactly one page, in order
    expect(d.chunks.flatMap((c) => Array.from({ length: c.last - c.first + 1 }, (_, i) => c.first + i))).toEqual(d.units.map((_, i) => i));
  });
  it("a short book of prose stays one page", () => {
    expect(parseTei(prose(2, 3, 1000)).chunks.map((c) => c.label)).toEqual(["Book 1", "Book 2"]);
  });
  it("a play's cast list does not get a page of its own", () => {
    const d = doc("tlg0011.tlg002.perseus-grc2");
    expect(d.chunks.every((c) => d.units.slice(c.first, c.last + 1).some((u) => plain(u.blocks).trim().length > 0))).toBe(true);
  });
});

describe("English cut only where a sentence or clause ends (review fix list, slice 8)", () => {
  const long = "So now I am still watching for the signal-flame, the gleaming fire that is to bring news from ";
  const piece = (key: string, c: Block["c"], speaker?: string) => ({ key, src: 0, blocks: [{ t: "l", n: key, c, ...(speaker ? { speaker } : {}) } as Block] });
  it("moves the rest of a sentence back to finish it, word for word", () => {
    const [a, b] = mendBreaks([piece("5", [long, "Troy", " and"]), piece("10", ["tidings of its capture.  For thus commands my queen."])]);
    expect(a.blocks[0].c.join("")).toBe(`${long}Troy and tidings of its capture.`);
    expect(b.blocks[0].c.join("")).toBe("For thus commands my queen.");
  });
  it("leaves verse, a finished sentence and a new speaker alone", () => {
    const verse = [piece("1", ["Sing, goddess, the wrath of"]), piece("2", ["Achilles, son of Peleus."])];
    expect(mendBreaks(verse)).toEqual(verse);
    const done = [piece("5", [long + "Troy."]), piece("10", ["Tidings of its capture."])];
    expect(mendBreaks(done)).toEqual(done);
    const speech = [piece("35", [long + "Enter the chorus of Argive Elders"]), piece("40", ["This is now the tenth year."], "Chorus")];
    expect(mendBreaks(speech)).toEqual(speech);
  });
});
