/**
 * The private collection in the reader (lib/mine.ts) and "Import a text" (lib/import-text.ts). Made-up placeholder text
 * only: no translation may ever be in this repository.
 */
import { describe, expect, it } from "vitest";
import { describe as describeText } from "@/lib/catalog";
import { isMine, mineBook, mineHref, mineId, mineParsed } from "./mine";
import { FORMAT, checkTranslation, type TranslationDoc } from "./private-translations";
import { alignChunk } from "@/lib/tei/align";
import { findRef } from "@/lib/tei/refs";
import type { Block } from "@/lib/tei/types";

const ok = (input: unknown): TranslationDoc => {
  const r = checkTranslation(input);
  if (!r.ok) throw new Error(r.problems.join(" | "));
  return r.doc;
};
const text = (bs: Block[]) => bs.map((b) => b.c.map((x) => (typeof x === "string" ? x : "")).join("")).join(" / ");

const DOC = ok({
  format: FORMAT, id: "placeholder-one", author: "Placeholder *Author*", title: "Placeholder Work", greekTitle: "Λόγος πρῶτος", status: "draft",
  urn: "urn:cts:greekLit:tlg9999.tlg001", publishedTranslation: "Placeholder published",
  passages: [
    {
      heading: "Placeholder heading *one*", locator: "Placeholder locator",
      rows: [
        { ref: "1.7", label: "1a10", greek: "λόγος ἐστί ⟦ἄλφα⟧", english: "Placeholder *one*.", published: "Published one." },
        { ref: "1.7", greek: "βῆτα\n\nγάμμα", english: "Placeholder two." },
        { ref: "1.8", greek: "δέλτα", english: "Placeholder three.", published: "Published three." },
      ],
    },
    { rows: [{ ref: "2.1", greek: "ἔψιλον\nζῆτα", english: "Placeholder four." }] },
  ],
});

describe("a stored document as a book of the reader", () => {
  it("names the book by its id, and only the Englishes it holds", () => {
    expect(isMine("mine:placeholder-one")).toBe(true);
    expect(isMine("tlg0012.tlg001")).toBe(false);
    expect(mineId("mine:placeholder-one")).toBe("placeholder-one");
    expect(mineHref("placeholder-one")).toBe("/read?w=mine:placeholder-one");
    const { work, author } = mineBook(DOC);
    expect(work.id).toBe("mine:placeholder-one");
    expect(work.title).toBe("Placeholder Work");
    expect(author.name).toBe("Placeholder Author");
    expect(work.texts.map((t) => t.urn)).toEqual(["mine:placeholder-one.grc", "mine:placeholder-one.ours", "mine:placeholder-one.published"]);
    expect(work.texts[0].label).toBe("Λόγος πρῶτος");
    expect(work.texts.map((t) => describeText(t))).toEqual(["Private collection", "Our English", "Published English"]);
    const greekOnly = ok({ format: FORMAT, id: "x", author: "A", title: "T", status: "imported", passages: [{ rows: [{ greek: "α" }] }] });
    expect(mineBook(greekOnly).work.texts.map((t) => t.kind)).toEqual(["edition"]);
  });

  it("numbers rows passage.row when references repeat, with the label or reference as a marker", () => {
    const { doc, placed } = mineParsed(DOC, "ours");
    expect(doc.levels).toEqual(["passage", "row"]);
    expect(doc.units.map((u) => u.ref.join("."))).toEqual(["1.1", "1.2", "1.3", "2.1"]);
    expect(doc.units[0].blocks[0].c[0]).toEqual({ m: "section", n: "1a10" });
    // a reference repeated from the row before is not marked again
    expect(doc.units[1].blocks[0].c[0]).toBe("βῆτα");
    expect(doc.units[2].blocks[0].c[0]).toEqual({ m: "section", n: "1.8" });
    expect(text(doc.units[0].blocks)).toBe("λόγος ἐστί ⟦ἄλφα⟧");
    expect(doc.units[1].blocks.map((b) => b.t)).toEqual(["p", "p"]);
    // a paragraph broken into lines is verse: a line each
    expect(doc.units[3].blocks.map((b) => b.t)).toEqual(["l", "l"]);
    expect(doc.chunks).toEqual([{ label: "1. Placeholder heading one", first: 0, last: 2 }, { label: "Passage 2", first: 3, last: 3 }]);
    expect(findRef(doc, "1a10")).toBe(0);

    const rows = doc.chunks.flatMap((c) => alignChunk(doc, c, placed));
    expect(rows.map((r) => r.key)).toEqual(["1.1", "1.2", "1.3", "2.1"]);
    expect(rows[0].trans[0]).toEqual({ t: "head", c: ["Placeholder heading one"] });
    expect(text(rows[0].trans.slice(1))).toBe("Placeholder one.");
  });

  it("shows the published English where chosen, and the Greek alone with none", () => {
    const pub = mineParsed(DOC, "published");
    const rows = pub.doc.chunks.flatMap((c) => alignChunk(pub.doc, c, pub.placed));
    // as in the reader's other books, English runs on beside the Greek after it that has none of its own
    expect(rows.map((r) => [r.key, text(r.trans)])).toEqual([["1.1", "Placeholder heading one / Published one."], ["1.3", "Published three."], ["2.1", ""]]);
    const none = mineParsed(DOC, null);
    expect(none.placed).toBeNull();
  });

  it("keeps a document's own references when every row has a different one", () => {
    const d = ok({ format: FORMAT, id: "x", author: "A", title: "T", status: "imported",
      passages: [{ heading: "Book 1", rows: [{ ref: "1.1", greek: "α" }, { ref: "1.2", greek: "β" }] }, { rows: [{ ref: "2.1", greek: "γ" }] }] });
    const { doc } = mineParsed(d, null);
    expect(doc.levels).toEqual(["chapter", "section"]);
    expect(doc.units.map((u) => u.ref.join("."))).toEqual(["1.1", "1.2", "2.1"]);
    expect(doc.units[0].blocks[0].c).toEqual(["α"]);
  });

});
