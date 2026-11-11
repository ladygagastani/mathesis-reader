import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseTei } from "@/lib/tei/parse";
import { analyse, type WordPack } from "./words";

// The word packs are generated (pipeline/build_words.py) and not committed; skip if absent.
const packFile = (w: string) => `public/data/words/${w}.json`;
const have = existsSync(packFile("tlg0012.tlg001")) && existsSync(packFile("tlg0059.tlg002"));

describe.skipIf(!have)("in-context analyses from GLAUx", () => {
  const setup = (work: string, fixture: string) => {
    const pack = JSON.parse(readFileSync(packFile(work), "utf8")) as WordPack;
    const doc = parseTei(readFileSync(`test-fixtures/${fixture}.xml`, "utf8"));
    return { pack, keys: new Set(doc.units.map((u) => u.ref.join("."))), depth: doc.levels.length };
  };

  it("Iliad 1.1: ἄειδε is the imperative of ἀείδω, checked by hand", () => {
    const { pack, keys, depth } = setup("tlg0012.tlg001", "tlg0012.tlg001.perseus-grc2");
    const a = analyse(pack, "ἄειδε", "1.1", 0, keys, depth)!;
    expect(a).toMatchObject({ lemma: "ἀείδω", tag: "v2spma---", manual: true, where: "here" });
  });

  it("matches elided words whatever apostrophe the text uses", () => {
    const { pack, keys, depth } = setup("tlg0012.tlg001", "tlg0012.tlg001.perseus-grc2");
    expect(analyse(pack, "μυρίʼ", "1.2", 0, keys, depth)?.lemma).toBe("μυρίος");
  });

  it("Apology 17: finds the passage by its Perseus section", () => {
    const { pack, keys, depth } = setup("tlg0059.tlg002", "tlg0059.tlg002.perseus-grc2");
    expect(analyse(pack, "ὑμεῖς", "17", 0, keys, depth)?.lemma).toBe("σύ");
  });

  it("falls back to how the form is analysed elsewhere in the work", () => {
    const { pack, keys, depth } = setup("tlg0012.tlg001", "tlg0012.tlg001.perseus-grc2");
    const a = analyse(pack, "Ἀχιλῆος", "1.100", 0, keys, depth)!;
    expect(a.where).toBe("work");
    expect(a.lemma).toBe("Ἀχιλλεύς");
  });
});
