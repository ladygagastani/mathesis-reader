import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeiDoc } from "@/lib/tei/types";
import fixture from "./fixtures/iliad-1-1.json";
import { shardOf, type LsjEntry } from "./lsj";
import type { WordPack } from "./words";

// The whole look-up for a word, from what the network gives (the real Iliad 1.1 to 1.7 slice the other tests use) to the card.
// The work id is made up for each test so the loaders' caches never carry one test's answer into another.
const pack = fixture.words as unknown as WordPack;
const doc = {
  lang: "grc", levels: ["book", "line"], chunks: [{ label: "1", first: 0, last: pack.units.length - 1 }],
  units: pack.units.map((u) => ({ ref: u[0][0].split("."), blocks: [{ t: "l", c: [u[2]] }] })),
} as unknown as TeiDoc;

const shards: Record<string, Record<string, LsjEntry[]>> = {};
for (const { head, entries } of Object.values(fixture.lsj as Record<string, { head: string; entries: LsjEntry[] }>)) {
  (shards[shardOf(head)] ??= {})[head] = entries;
}
const core = { words: Object.fromEntries(Object.entries(fixture.core as Record<string, { def: string }>).map(([k, v]) => [k, [{ head: k, def: v.def, pos: "", group: "", rank: 1 }]])) };

let wordsStatus = 200;
// the form index's shards (forms.ts) and the parser's answers (morpheus.ts), as each test sets them; none by default
let formShards: Record<string, unknown> = {};
let parser: Record<string, unknown> = {};
beforeEach(() => {
  wordsStatus = 200;
  formShards = {};
  parser = {};
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.includes("/words/")) return wordsStatus === 200 ? json(pack) : new Response("", { status: wordsStatus });
    if (url.includes("/syntax/")) return json(fixture.syntax);
    if (url.includes("/lsj/")) { const s = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1, -5)); return shards[s] ? json(shards[s]) : new Response("", { status: 404 }); }
    if (url.endsWith("/core.json")) return json(core);
    if (url.startsWith("/forms/")) { const s = decodeURIComponent(url.slice(7, -5)); return formShards[s] ? json(formShards[s]) : new Response("", { status: 404 }); }
    if (url.includes("morph.alpheios.net")) { const w = new URL(url).searchParams.get("word")!; return w in parser ? json(parser[w]) : json({ RDF: { Annotation: {} } }); }
    return new Response("", { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

let n = 0;
const at = (word: string, unitKey: string, i: number, occurrence = 0) => ({ work: `test.${n++}`, word, unitKey, i, occurrence, doc });

describe("looking up a word", () => {
  it("gives μῆνιν its dictionary form, meaning, role and grammar, and counts it", async () => {
    const { lookUp } = await import("./lookup");
    const r = await lookUp(at("μῆνιν", "1.1", 0));
    expect(r.card.lemma).toBe("μῆνις");
    expect(r.card.meaning).toEqual({ text: "wrath, revengeful temper", source: "lsj" });
    expect(r.card.role?.lead).toBe("Here it is the object of");
    expect(r.card.grammar).toBe("Accusative singular");
    expect(r.occurs).toBe(1);
    expect(r.lsj?.head).toBe("μῆνις");
  });

  it("still finds the dictionary entry when the word analyses cannot be loaded, and says why", async () => {
    wordsStatus = 503;
    const { lookUp } = await import("./lookup");
    const r = await lookUp(at("θεά", "1.1", 2));
    expect(r.analysis).toBeNull();
    expect(r.analysisError).toMatch(/503/);
    expect(r.lsj?.head).toBe("θεά");
    expect(r.card.lemma).toBe("θεά");
  });
});

describe("looking up a word followed from a word family", () => {
  it("gives its LSJ entry and its core meaning, with no analysis or count", async () => {
    const { lookUpHeadword } = await import("./lookup");
    const r = await lookUpHeadword("ὅς");
    expect(r.lsj?.head).toBe("ὅς");
    expect(r.card.lemma).toBe("ὅς");
    expect(r.card.meaning.source).toBe("core");
    expect(r.analysis).toBeNull();
    expect(r.occurs).toBeNull();
  });

  it("says plainly when neither dictionary has it", async () => {
    const { lookUpHeadword } = await import("./lookup");
    const r = await lookUpHeadword("διὰ παντός");
    expect(r.lsj).toBeNull();
    expect(r.card.meaning.source).toBeNull();
  });
});

describe("looking up a word in a text GLAUx does not cover", () => {
  it("reads the form as GLAUx reads it in its other texts, commonest first", async () => {
    wordsStatus = 404;
    formShards = { "μη": { l: ["μῆνις"], t: ["n-s---fa-", "n-s---fn-"], f: { "μῆνιν": [0, 0, 40, 0, 1, 2] } } };
    const { lookUp } = await import("./lookup");
    const r = await lookUp(at("μῆνιν", "1.1", 0));
    expect(r.analysis?.where).toBe("corpus");
    expect(r.analysis?.others).toEqual([{ lemma: "μῆνις", tag: "n-s---fa-", n: 40 }, { lemma: "μῆνις", tag: "n-s---fn-", n: 2 }]);
    expect(r.card.lemma).toBe("μῆνις");
    expect(r.card.kind).toBe("noun, feminine");
    expect(r.card.grammar).toBe("Accusative singular");
    expect(r.lsj?.head).toBe("μῆνις");
    expect(r.occurs).toBeNull();
  });

  it("reads a sentence's capital as the word, not as the few places GLAUx took it for a name", async () => {
    wordsStatus = 404;
    formShards = { "τη": { l: ["Τά", "ὁ"], t: ["n-s---fa-", "l-s---fa-"], f: { "Τὴν": [0, 0, 12], "τὴν": [1, 1, 90000] } } };
    const { formReading } = await import("./forms");
    expect((await formReading("Τὴν"))?.lemma).toBe("ὁ");
  });

  it("asks the parser for a form no text in GLAUx has, and puts its reading in GLAUx's terms", async () => {
    wordsStatus = 404;
    parser = { "ἄειδε": { RDF: { Annotation: { Body: { rest: { entry: {
      dict: { hdwd: { $: "ἀείδω2" }, pofs: { $: "verb" } },
      infl: [{ pofs: { $: "verb" }, mood: { $: "imperative" }, num: { $: "singular" }, pers: { $: "2nd" }, tense: { $: "present" }, voice: { $: "active" } },
        { pofs: { $: "verb" }, mood: { $: "indicative" }, num: { $: "singular" }, pers: { $: "3rd" }, tense: { $: "imperfect" }, voice: { $: "active" } }],
    } } } } } } };
    const { lookUp } = await import("./lookup");
    const r = await lookUp(at("ἄειδε", "1.1", 1));
    expect(r.analysis?.where).toBe("parser");
    expect(r.analysis?.lemma).toBe("ἀείδω");
    expect(r.analysis?.others.map((o) => o.tag)).toEqual(["v2spma---", "v3siia---"]);
    expect(r.card.grammar).toBe("Present active imperative, 2nd person singular");
    expect(r.lsj?.head).toBe("ἀείδω");
  });

  it("with neither, finds the dictionary entry by the word's own spelling, as before", async () => {
    wordsStatus = 404;
    const { lookUp } = await import("./lookup");
    const r = await lookUp(at("θεά", "1.1", 2));
    expect(r.analysis).toBeNull();
    expect(r.lsj?.head).toBe("θεά");
  });
});
