import { describe, expect, it } from "vitest";
import { countLemma, occursLine } from "./occurrences";
import { repeatsMeaning, otherDefinitions } from "./repeats";
import { creditsFor, GLAUX_CREDIT, LSJ_CREDIT_SHORT } from "./credits";
import { certaintyNote } from "./certainty";
import { LSJ_CREDIT } from "./lsj";
import { CORE_CREDIT } from "./core";
import { analyse, type WordPack } from "./words";
import fixture from "./fixtures/iliad-1-1.json";

// The look-up's second layer (the quiet desk, ticket 06), on real data: Iliad 1.1 to 1.7, with its GLAUx analysis, LSJ and the
// core vocabulary, as the packs repository gives them (fixtures/iliad-1-1.json names where each slice comes from).
const pack = fixture.words as unknown as WordPack;
const lsj = fixture.lsj as Record<string, { head: string; entries: { s: string }[] }>;
const core = fixture.core as Record<string, { def: string }>;
const keys = new Set(pack.units.map((u) => u[0][0]));

/** the lemmas of a slice, counted the plain way: word by word */
const byHand = (lemma: string) => pack.units.reduce((n, u) => n + u[3].filter((id) => pack.lemmas[id] === lemma).length, 0);

describe("where else a word occurs", () => {
  it("counts a dictionary form in the work's word pack", () => {
    // the slice is Iliad 1.1 to 1.7: μῆνις stands once there (1.1); the whole Iliad has it 12 times (9 as μῆνιν, 3 as μῆνις),
    // counted the same way on the whole pack, which is too big to keep here
    expect(countLemma(pack, "μῆνις")).toBe(1);
    expect(countLemma(pack, "μῆνις")).toBe(byHand("μῆνις"));
  });

  it("counts every lemma of the slice exactly as the words stand", () => {
    for (const lemma of new Set(pack.lemmas)) expect(countLemma(pack, lemma), lemma).toBe(byHand(lemma));
    // and all the slice's words together are all the slice's analysed words
    const total = [...new Set(pack.lemmas)].reduce((n, l) => n + countLemma(pack, l), 0);
    expect(total).toBe(pack.units.reduce((n, u) => n + u[3].length, 0));
  });

  it("is nought for a word the work does not analyse", () => {
    expect(countLemma(pack, "οὐκ ἔστι τοιοῦτο")).toBe(0);
  });

  it("says it in words, with a number only when there is one", () => {
    expect(occursLine(12, "Iliad")).toBe("12 times in the Iliad");
    expect(occursLine(1234, "Iliad")).toBe("1,234 times in the Iliad");
    expect(occursLine(1, "Iliad")).toBe("Once in the Iliad");
    expect(occursLine(12, undefined)).toBe("12 times in this work");
    expect(occursLine(null, "Iliad")).toBeNull();
    expect(occursLine(0, "Iliad")).toBeNull();
  });

});

describe("a meaning is said once", () => {
  const a = analyse(pack, "μῆνιν", "1.1", 0, keys, 2)!;
  const meaning = lsj[a.lemma].entries[0].s;   // "wrath, revengeful temper"

  it("knows a line that only repeats the meaning, in whole or by its pieces", () => {
    expect(meaning).toBe("wrath, revengeful temper");
    expect(repeatsMeaning("wrath, revengeful temper", meaning)).toBe(true);
    expect(repeatsMeaning("Revengeful temper; wrath", meaning)).toBe(true);
    expect(repeatsMeaning("wrath", meaning)).toBe(true);
    expect(repeatsMeaning("wrath, anger", meaning)).toBe(false);
    expect(repeatsMeaning("", meaning)).toBe(false);
  });

});

describe("what Dictionary · LSJ shows besides the meaning", () => {
  // the meaning the card gives: the core list's definition where the word is on it, otherwise LSJ's first short definition
  const meaningOf = (lemma: string) => core[lemma]?.def ?? lsj[lemma].entries[0].s;
  const keys = (es: { k?: string }[]) => es.map((e) => e.k);

  it("has no short definition to add for μῆνιν: LSJ's one is the meaning (the entry's own start is shown instead)", () => {
    expect(otherDefinitions(lsj["μῆνις"].entries, meaningOf("μῆνις"))).toEqual([]);
  });

  it("adds the short definition of an entry the card does not quote (ὅς has two entries in LSJ)", () => {
    const entries = lsj["ὅς"].entries as { k: string; s: string }[];
    expect(entries).toHaveLength(2);
    expect(keys(otherDefinitions(entries, entries[0].s))).toEqual(["o(/s2"]);
  });

  it("adds LSJ's own short definition when the card's meaning came from the core list instead", () => {
    expect(meaningOf("μυρίος")).toBe(core["μυρίος"].def);
    expect(keys(otherDefinitions(lsj["μυρίος"].entries as { k: string; s: string }[], meaningOf("μυρίος")))).toEqual(["muri/os"]);
  });

  it("adds nothing for an entry with no short definition at all (Ἀχιλλεύς), whatever the card says", () => {
    const entries = lsj["Ἀχιλλεύς"].entries;
    expect(entries[0].s).toBe("");
    expect(otherDefinitions(entries, null)).toEqual([]);
    expect(otherDefinitions(entries, "LSJ has no short definition for it. See More about it.")).toEqual([]);
  });

  it("compares as plain words, without capitals or punctuation", () => {
    expect(otherDefinitions([{ s: "Wrath; revengeful temper" }], "wrath, revengeful temper")).toEqual([]);
  });
});

describe("the credits at the foot", () => {
  it("names the analysis, LSJ and, when shown, the core list, each once", () => {
    const all = creditsFor({ glaux: true, lsj: true, core: true });
    expect(all.map((c) => c.text)).toEqual([GLAUX_CREDIT, LSJ_CREDIT_SHORT, CORE_CREDIT]);
  });

  it("names only what is shown", () => {
    // μῆνιν in Iliad 1.1: analysed by GLAUx, an LSJ entry, meaning from LSJ (not on the core list)
    expect(core["μῆνις"]).toBeUndefined();
    expect(creditsFor({ glaux: true, lsj: true, core: false }).map((c) => c.text))
      .toEqual(["Analysis and treebank: GLAUx (Keersmaekers 2021), CC BY-SA 4.0", "LSJ: Perseus Digital Library, CC BY-SA"]);
    expect(creditsFor({ glaux: false, lsj: false, core: false })).toEqual([]);
  });

  it("keeps Perseus and the licence of the full LSJ credit, and GLAUx's licence", () => {
    for (const word of ["Perseus", "CC BY-SA"]) { expect(LSJ_CREDIT).toContain(word); expect(LSJ_CREDIT_SHORT).toContain(word); }
    expect(GLAUX_CREDIT).toMatch(/GLAUx \(Keersmaekers 2021\), CC BY-SA 4\.0/);
  });
});

describe("how sure the look-up is, in one sentence", () => {
  it("says a hand-checked word was checked by hand", () => {
    const a = analyse(pack, "μῆνιν", "1.1", 0, keys, 2)!;
    expect(a.where).toBe("here");
    expect(certaintyNote(a)).toBe("Checked by hand: this analysis comes from the treebank.");
  });

  it("says an automatic analysis is automatic", () => {
    const a = analyse(pack, "μῆνιν", "1.1", 0, keys, 2)!;
    expect(certaintyNote({ ...a, manual: false })).toBe("Automatic analysis, about 97% accurate.");
  });

  it("says a word matched to its passage, not to its place", () => {
    const a = analyse(pack, "μῆνιν", "1.1", 3, keys, 2)!;   // the passage has μῆνιν once, so a fourth is only matched to the passage
    expect(a.where).toBe("passage");
    expect(certaintyNote(a)).toBe("Matched to this passage, not to this exact word.");
  });

  it("lists how the form is analysed elsewhere in the work when its place cannot be matched", () => {
    const a = analyse(pack, "μῆνιν", "9.9", 0, keys, 2)!;
    expect(a.where).toBe("work");
    expect(certaintyNote(a)).toBe("This exact place could not be matched; elsewhere in this work the form is analysed as μῆνις, noun · accusative singular feminine (1×).");
  });

  it("says plainly when there is no analysis, or it could not be loaded", () => {
    expect(certaintyNote(null)).toBe("No analysis is available for this text yet.");
    expect(certaintyNote(null, "word analyses unavailable (503)")).toBe("Word analyses could not be loaded (word analyses unavailable (503)).");
  });
});
