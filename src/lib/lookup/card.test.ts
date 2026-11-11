import { describe, expect, it } from "vitest";
import { lookupCard, NO_ENTRY, NO_SHORT, treeAt, type CardInput } from "./card";
import { analyse, type WordPack } from "./words";
import { readSyntax } from "@/lib/syntax";
import type { TeiDoc } from "@/lib/tei/types";
import fixture from "./fixtures/iliad-1-1.json";

// The look-up card, on real data: Iliad 1.1 to 1.7 (the first treebank sentence), with its GLAUx analysis, its treebank
// sentence, the core vocabulary and LSJ, as the packs repository gives them (fixtures/iliad-1-1.json names where each slice
// comes from).
const pack = fixture.words as unknown as WordPack;
const syn = readSyntax(fixture.syntax as unknown as Parameters<typeof readSyntax>[0]);
const lsj = fixture.lsj as Record<string, { head: string; entries: { k: string; s: string }[] }>;
const core = fixture.core as Record<string, { def: string }>;
// the passage as the reader shows it: one line to a passage, cited book.line
const doc = {
  lang: "grc", levels: ["book", "line"], chunks: [{ label: "1", first: 0, last: pack.units.length - 1 }],
  units: pack.units.map((u) => ({ ref: u[0][0].split("."), blocks: [{ t: "l", c: [u[2]] }] })),
} as unknown as TeiDoc;
const keys = new Set(pack.units.map((u) => u[0][0]));
const words = (ref: string) => pack.units.find((u) => u[0][0] === ref)![2].split(" ").filter((w) => /\p{L}/u.test(w));

/** What the look-up does for the i-th word of a line: its analysis, its place in the sentence, the core list and LSJ. */
function input(ref: string, i: number, withTree = true): CardInput {
  const word = words(ref)[i];
  const occurrence = words(ref).slice(0, i).filter((w) => w === word).length;
  const analysis = analyse(pack, word, ref, occurrence, keys, 2);
  return {
    analysis,
    tree: withTree ? treeAt(pack, syn, doc, ref, i) : null,
    core: analysis ? core[analysis.lemma] ?? null : null,
    lsj: analysis ? lsj[analysis.lemma] ?? null : null,
  };
}
const card = (ref: string, i: number, withTree = true) => lookupCard(input(ref, i, withTree));

describe("the look-up card for μῆνιν, Iliad 1.1", () => {
  const c = card("1.1", 0);
  it("gives the dictionary form and the kind of word", () => {
    expect(c.lemma).toBe("μῆνις");
    expect(c.kind).toBe("noun, feminine");
  });
  it("gives LSJ's short definition, naming LSJ, since the word is not on the core list", () => {
    expect(c.meaning).toEqual({ text: "wrath, revengeful temper", source: "lsj" });
  });
  it("gives the grammar in plain words", () => expect(c.grammar).toBe("Accusative singular"));
  it("says what it does in the sentence, from the treebank", () => {
    expect(c.role).toEqual({ text: "object of ἄειδε", lead: "Here it is the object of", governor: "ἄειδε" });
  });
});

describe("the role in the sentence", () => {
  it("is the main verb for the verb the sentence is built round", () => {
    const c = card("1.1", 1);   // ἄειδε
    expect(c.kind).toBe("verb");
    expect(c.grammar).toBe("Present active imperative, 2nd person singular");
    expect(c.role).toEqual({ text: "main verb of the sentence", lead: "Here it is the main verb of the sentence", governor: null });
  });
  it("reaches the word a genitive describes", () => {
    expect(card("1.1", 3).role?.text).toBe("attribute of Ἀχιλῆος");   // Πηληϊάδεω
  });
  it("is nothing for a relation the table does not name (the goddess addressed)", () => {
    const c = card("1.1", 2);   // θεά, a vocative: the treebank calls it outside the sentence's structure
    expect(c.grammar).toBe("Vocative singular");
    expect(c.role).toBeNull();
  });
  it("is nothing for a work with no treebank", () => {
    const c = card("1.1", 0, false);
    expect(c.role).toBeNull();
    // the rest of the card does not depend on the treebank
    expect(c.lemma).toBe("μῆνις");
    expect(c.grammar).toBe("Accusative singular");
    expect(treeAt(pack, null, doc, "1.1", 0)).toBeNull();
  });
  it("is nothing where the treebank has no such word", () => {
    expect(treeAt(pack, syn, doc, "9.9", 0)).toBeNull();
    expect(treeAt(pack, syn, doc, "1.1", 99)).toBeNull();
  });
  it("only ever names a word of its own sentence", () => {
    for (const [ref, ws] of pack.units.map((u) => [u[0][0], words(u[0][0])] as const)) {
      ws.forEach((_, i) => {
        const t = treeAt(pack, syn, doc, ref, i), r = card(ref, i).role;
        if (r?.governor) expect(t!.sentence.nodes.map((n) => n.form)).toContain(r.governor);
      });
    }
  });
});

describe("the meaning line", () => {
  it("is the core vocabulary's definition where the word is on that list, and says so", () => {
    const c = card("1.3", 3);   // ψυχὰς
    expect(c.lemma).toBe("ψυχή");
    expect(c.meaning).toEqual({ text: "breath, life, soul", source: "core" });
    expect(lsj["ψυχή"].entries[0].s).not.toBe("breath, life, soul");   // LSJ's own short definition is a different one
    expect(c.grammar).toBe("Accusative plural");
  });
  it("says plainly when neither dictionary has the word", () => {
    const c = card("1.1", 3);   // Πηληϊάδεω: Πηληϊάδης is in neither
    expect(c.lemma).toBe("Πηληϊάδης");
    expect(c.meaning).toEqual({ text: NO_ENTRY, source: null });
    expect(NO_ENTRY).toBe("Not in the dictionaries this site uses.");
  });
  it("says plainly when LSJ has an entry but no short definition", () => {
    const c = card("1.1", 4);   // Ἀχιλῆος: LSJ's Ἀχιλλεύς has no short definition
    expect(lsj["Ἀχιλλεύς"].entries[0].s).toBe("");
    expect(c.meaning).toEqual({ text: NO_SHORT, source: null });
  });
  it("never makes one up: every meaning is a core definition or LSJ's short definition, word for word", () => {
    let n = 0;
    for (const u of pack.units) words(u[0][0]).forEach((_, i) => {
      const inp = input(u[0][0], i), m = lookupCard(inp).meaning;
      n++;
      if (m.source === "core") expect(m.text).toBe(inp.core!.def);
      else if (m.source === "lsj") expect(m.text).toBe(inp.lsj!.entries[0].s);
      else expect([NO_ENTRY, NO_SHORT]).toContain(m.text);
      // and the statement is only ever made where it is true
      if (m.text === NO_ENTRY) expect(inp.core?.def || inp.lsj?.entries.length).toBeFalsy();
      if (m.text === NO_SHORT) expect(inp.lsj!.entries[0].s).toBe("");
    });
    expect(n).toBe(44 - pack.units.filter((u) => u[2].includes(".")).length);
  });
  it("falls back to LSJ when the core list lacks the word, and to the plain statement when LSJ does too", () => {
    const base = input("1.3", 3);
    expect(lookupCard({ ...base, core: null }).meaning).toEqual({ text: lsj["ψυχή"].entries[0].s, source: "lsj" });
    expect(lookupCard({ ...base, core: null, lsj: null }).meaning).toEqual({ text: NO_ENTRY, source: null });
  });
});

describe("with no analysis of the word", () => {
  it("keeps to the dictionary: LSJ's headword and short definition, and no grammar or role", () => {
    const c = lookupCard({ analysis: null, tree: null, core: null, lsj: lsj["μῆνις"] });
    expect(c).toEqual({ lemma: "μῆνις", kind: null, meaning: { text: "wrath, revengeful temper", source: "lsj" }, role: null, grammar: null });
  });
  it("has nothing to show for a word no dictionary has", () => {
    expect(lookupCard({ analysis: null, tree: null, core: null, lsj: null })).toEqual({ lemma: null, kind: null, meaning: { text: NO_ENTRY, source: null }, role: null, grammar: null });
  });
});
