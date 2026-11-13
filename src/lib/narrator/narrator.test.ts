import { describe, expect, it } from "vitest";
import { addSayAs, readPrefs, NARRATOR_DEFAULTS } from "./prefs";
import { duration, minutesFor, segments, sentences, speakable, wordAt, wordCount } from "./text";
import { accent, isNatural, pickVoice, rankVoices, shortName, type VoiceLike } from "./voices";

const slice = (t: string, list: [number, number][]) => list.map(([s, e]) => t.slice(s, e));

describe("sentences", () => {
  it("cuts English at its sentences, trimmed", () => {
    const t = "How you, O Athenians, have been affected by my accusers, I cannot tell. But I know that they almost made me forget who I was!  Yes.";
    expect(slice(t, sentences(t))).toEqual([
      "How you, O Athenians, have been affected by my accusers, I cannot tell.",
      "But I know that they almost made me forget who I was!",
      "Yes.",
    ]);
  });
  it("ends a sentence at a line break (a speaker's name)", () => {
    const t = "SOCRATES\nAnd what do you say?";
    expect(slice(t, sentences(t))).toEqual(["SOCRATES", "And what do you say?"]);
  });
  it("leaves out what has no words", () => {
    const t = "Go. … — Come.";
    expect(slice(t, sentences(t)).join("|")).not.toMatch(/^…$/m);
  });
});

describe("segments", () => {
  it("keeps a short sentence whole", () => {
    const t = "Sing, goddess, the wrath.";
    expect(segments(t)).toEqual([{ start: 0, end: t.length, sentence: [0, t.length] }]);
  });
  it("cuts a long sentence at a semicolon before a comma, each piece within the limit", () => {
    const a = "This is the first clause of a long sentence, which goes on for a good while yet";
    const t = `${a}; and here is the second, which also goes on, and on, and on until it is long enough to need cutting again, too.`;
    const segs = segments(t, 100);
    expect(segs.length).toBeGreaterThan(1);
    expect(t.slice(segs[0].start, segs[0].end)).toBe(`${a};`);
    for (const s of segs) {
      expect(s.end - s.start).toBeLessThanOrEqual(100);
      expect(s.sentence).toEqual([0, t.length]);
    }
    // nothing lost: the pieces, joined, are the sentence
    expect(segs.map((s) => t.slice(s.start, s.end)).join(" ")).toBe(t);
  });
});

describe("speakable", () => {
  it("drops an editor's brackets but keeps their words, and says abbreviations in words", () => {
    const { spoken } = speakable("He came [to the city], cf. the first book; i.e. home &c.");
    expect(spoken).toBe("He came to the city, compare the first book; that is home et cetera");
  });
  it("uses the reader's pronunciations, whole words only, in any case", () => {
    const { spoken } = speakable("The Achaeans and the achaeans, not Achaeansville.", [{ write: "Achaeans", say: "a-kee-ans" }]);
    expect(spoken).toBe("The a-kee-ans and the a-kee-ans, not Achaeansville.");
  });
  it("maps each spoken word back to the text it stands for", () => {
    const text = "Then  [Achilles]  spoke.";
    const { spoken, from, to } = speakable(text, [{ write: "Achilles", say: "a-kill-eez" }]);
    expect(spoken).toBe("Then a-kill-eez spoke.");
    const i = spoken.indexOf("a-kill-eez");
    const [s, e] = wordAt(spoken, from, to, i)!;
    expect(text.slice(s, e)).toBe("Achilles");
    const j = spoken.indexOf("spoke");
    const [s2, e2] = wordAt(spoken, from, to, j, 5)!;
    expect(text.slice(s2, e2)).toBe("spoke");
  });
  it("finds nothing past the end", () => {
    const { spoken, from, to } = speakable("Yes.");
    expect(wordAt(spoken, from, to, 10)).toBeNull();
  });
});

describe("time", () => {
  it("counts words and minutes", () => {
    expect(wordCount("O men of Athens, I don’t know.")).toBe(7);
    expect(minutesFor(330, 1)).toBe(2);
    expect(minutesFor(330, 2)).toBe(1);
    expect(duration(0)).toBe("under a minute");
    expect(duration(1)).toBe("1 minute");
    expect(duration(65)).toBe("1 hour 5 minutes");
  });
});

const v = (name: string, lang: string, o: Partial<VoiceLike> = {}): VoiceLike => ({ name, lang, localService: true, voiceURI: name, default: false, ...o });

describe("voices", () => {
  const all = [
    v("Microsoft David - English (United States)", "en-US", { default: true }),
    v("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB", { localService: false }),
    v("Google UK English Female", "en-GB", { localService: false }),
    v("Bubbles", "en-US"),
    v("Thomas", "fr-FR"),
    v("Serena (Premium)", "en-GB"),
  ];
  it("ranks the natural voices first, and leaves out joke voices and other languages", () => {
    const names = rankVoices(all, "en-GB").map((x) => x.name);
    expect(names[0]).toMatch(/Sonia/);
    expect(names[1]).toMatch(/Serena/);
    expect(names).not.toContain("Bubbles");
    expect(names).not.toContain("Thomas");
    expect(names[names.length - 1]).toMatch(/David/);
  });
  it("names a voice and its accent plainly", () => {
    expect(shortName(all[1])).toBe("Sonia");
    expect(shortName(all[5])).toBe("Serena");
    expect(shortName(all[2])).toBe("Google UK English Female");
    expect(accent("en-GB")).toBe("British");
    expect(accent("en_US")).toBe("American");
    expect(accent("en")).toBe("English");
    expect(isNatural(all[1])).toBe(true);
    expect(isNatural(all[0])).toBe(false);
  });
  it("keeps the chosen voice, or takes the best when the device lacks it", () => {
    const ranked = rankVoices(all);
    expect(pickVoice(ranked, "Google UK English Female")?.name).toBe("Google UK English Female");
    expect(pickVoice(ranked, "gone")?.name).toMatch(/Sonia/);
    expect(pickVoice([], "x")).toBeNull();
  });
});

describe("narrator settings", () => {
  it("falls back to the defaults for anything damaged or out of range", () => {
    expect(readPrefs("not json")).toEqual(NARRATOR_DEFAULTS);
    expect(readPrefs(JSON.stringify({ rate: 9, pitch: 0.1, gap: "huge", follow: "yes" }))).toEqual(NARRATOR_DEFAULTS);
    expect(readPrefs(JSON.stringify({ rate: 1.25, gap: "long", say: [{ write: " Zeus ", say: "zoose" }, { write: "", say: "x" }, 3] })))
      .toMatchObject({ rate: 1.25, gap: "long", say: [{ write: "Zeus", say: "zoose" }] });
  });
  it("replaces a pronunciation of the same word", () => {
    const list = addSayAs([{ write: "Zeus", say: "zoose" }], "zeus", "zyoos");
    expect(list).toEqual([{ write: "zeus", say: "zyoos" }]);
    expect(addSayAs(list, "  ", "x")).toBe(list);
  });
});
