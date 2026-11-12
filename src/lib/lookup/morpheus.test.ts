import { describe, expect, it } from "vitest";
import { certaintyNote } from "./certainty";
import { parseMorpheus, tagOf } from "./morpheus";

const answer = (...entries: unknown[]) => ({ RDF: { Annotation: { Body: entries.map((entry) => ({ rest: { entry } })) } } });

describe("the Morpheus parser's readings in GLAUx's terms", () => {
  it("tags a verb, a participle and a noun as GLAUx does", () => {
    expect(tagOf({ pofs: { $: "verb" }, mood: { $: "indicative" }, num: { $: "singular" }, pers: { $: "3rd" }, tense: { $: "aorist" }, voice: { $: "active" } }, undefined)).toBe("v3saia---");
    expect(tagOf({ pofs: { $: "verb participle" }, case: { $: "nominative" }, gend: { $: "masculine" }, mood: { $: "participle" }, num: { $: "plural" }, tense: { $: "present" }, voice: { $: "active" } }, undefined)).toBe("v-pppamn-");
    // a noun's gender is its dictionary entry's when the inflection does not give it
    expect(tagOf({ pofs: { $: "noun" }, case: { $: "dative" }, num: { $: "plural" } }, { gend: { $: "neuter" } })).toBe("n-p---nd-");
    expect(tagOf({ pofs: { $: "article" }, case: { $: "accusative" }, gend: { $: "neuter" }, num: { $: "plural" } }, undefined)).toBe("l-p---na-");
  });

  it("keeps every reading once, the first first, and drops the homograph number", () => {
    const a = parseMorpheus(answer(
      { dict: { hdwd: { $: "ὁ" } }, infl: [
        { pofs: { $: "article" }, case: { $: "accusative" }, gend: { $: "neuter" }, num: { $: "plural" } },
        { pofs: { $: "article" }, case: { $: "nominative" }, gend: { $: "neuter" }, num: { $: "plural" } },
        { pofs: { $: "article" }, case: { $: "accusative" }, gend: { $: "neuter" }, num: { $: "plural" } },
      ] },
      { dict: { hdwd: { $: "λέγω2" } }, infl: { pofs: { $: "verb" }, mood: { $: "infinitive" }, tense: { $: "present" }, voice: { $: "active" } } },
    ));
    expect(a?.where).toBe("parser");
    expect(a?.others.map((o) => `${o.lemma} ${o.tag}`)).toEqual(["ὁ l-p---na-", "ὁ l-p---nn-", "λέγω v--pna---"]);
  });

  it("has no reading when Morpheus knows no such form", () => {
    expect(parseMorpheus({ RDF: { Annotation: {} } })).toBeNull();
    expect(parseMorpheus(null)).toBeNull();
  });
});

describe("how sure, for a reading from outside the text", () => {
  it("says the form index's readings are from GLAUx's other texts, with how often", () => {
    const note = certaintyNote({ lemma: "ὁ", tag: "l-p---na-", manual: false, where: "corpus", others: [{ lemma: "ὁ", tag: "l-p---na-", n: 94938 }] });
    expect(note).toBe("This word is not analysed in this text. In GLAUx's other texts the form is read as ὁ, article · accusative plural neuter (94,938×).");
  });

  it("says the parser saw the word alone, and that the word was sent", () => {
    const note = certaintyNote({ lemma: "λύω", tag: "v3saia---", manual: false, where: "parser", others: [{ lemma: "λύω", tag: "v3saia---", n: 0 }] });
    expect(note).toMatch(/sent to the Morpheus parser \(morph\.alpheios\.net\)/);
    expect(note).toMatch(/its reading: λύω, verb · aorist active indicative · 3rd person singular\.$/);
  });
});
