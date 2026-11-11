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
beforeEach(() => {
  wordsStatus = 200;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.includes("/words/")) return wordsStatus === 200 ? json(pack) : new Response("", { status: wordsStatus });
    if (url.includes("/syntax/")) return json(fixture.syntax);
    if (url.includes("/lsj/")) { const s = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1, -5)); return shards[s] ? json(shards[s]) : new Response("", { status: 404 }); }
    if (url.endsWith("/core.json")) return json(core);
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
