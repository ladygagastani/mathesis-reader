import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { packForms, phraseOf, readSentence, readSyntax, roleOf, sentenceOf } from "./syntax";
import type { WordPack } from "./lookup/words";

const have = existsSync("public/data/syntax/tlg0012.tlg001.json") && existsSync("public/data/words/tlg0012.tlg001.json");

describe.runIf(have)("the Iliad's first sentence", () => {
  const syn = readSyntax(JSON.parse(readFileSync("public/data/syntax/tlg0012.tlg001.json", "utf8")));
  const pack = JSON.parse(readFileSync("public/data/words/tlg0012.tlg001.json", "utf8")) as WordPack;
  const forms = packForms(pack);
  const s = readSentence(syn, sentenceOf(syn, 0), forms);
  const node = (f: string) => s.nodes.find((n) => n.form === f)!;
  it("is read as GLAUx gives it, checked by hand", () => {
    expect(s.manual).toBe(true);
    expect(s.nodes[0].form).toBe("μῆνιν");
    // μῆνιν is the object of ἄειδε; Ἀχιλῆος describes μῆνιν; θεὰ, the goddess addressed, is outside the sentence
    expect(s.nodes[node("μῆνιν").head].form).toBe("ἄειδε");
    expect(roleOf(node("μῆνιν").rel).name).toBe("object");
    expect(s.nodes[node("Ἀχιλῆος").head].form).toBe("μῆνιν");
    expect(roleOf(node("θεὰ").rel).name).toBe("outside the sentence");
    expect(roleOf(node("ἄειδε").rel)).toMatchObject({ name: "main verb", joined: true });
  });
  it("finds the sentence of any word, and a word's whole phrase", () => {
    expect(sentenceOf(syn, 3)).toBe(sentenceOf(syn, 0));
    const ph = phraseOf(s, node("μῆνιν").i).map((i) => s.nodes[i].form);
    expect(ph.slice(0, 4)).toEqual(["μῆνιν", "Πηληϊάδεω", "Ἀχιλῆος", "οὐλομένην"]);
    // every word of the pack belongs to exactly one sentence, in order
    expect(syn.starts[syn.starts.length - 1]).toBe(forms.length);
  });
});

describe("roleOf", () => {
  it("names a role in plain words, with its suffix", () => {
    expect(roleOf("OBJ_CO")).toMatchObject({ name: "object", joined: true });
    expect(roleOf("XYZ").name).toBe("XYZ");
  });
});
