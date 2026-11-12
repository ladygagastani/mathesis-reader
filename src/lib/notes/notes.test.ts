import { describe, expect, it } from "vitest";
import { mergeNotes, newId, newerThan, parseNote, parseNotes, placeName, shown, type Note } from "./notes";

const note = (id: string, updated: number, extra: Partial<Note> = {}): Note => ({
  id, work: "tlg0059.tlg002", book: "Plato, Apology", anchor: { kind: "word", unit: "17a", i: 3, word: "λόγος" }, colour: "red", text: "a note", updated, ...extra,
});

describe("reading a stored note", () => {
  it("keeps a good note of each kind", () => {
    expect(parseNote(note("a1", 5))).toEqual(note("a1", 5));
    expect(parseNote(note("a1", 5, { anchor: { kind: "line", unit: "1.5", line: 0, lines: 1 } }))?.anchor).toEqual({ kind: "line", unit: "1.5", line: 0, lines: 1 });
    expect(parseNote(note("a1", 5, { anchor: { kind: "passage", unit: "17a" }, deleted: true }))?.deleted).toBe(true);
  });
  it("leaves out what is not a note, and never shows it half-read", () => {
    expect(parseNote(null)).toBeNull();
    expect(parseNote({ ...note("a1", 5), colour: "purple" })).toBeNull();
    expect(parseNote({ ...note("a1", 5), id: "Not Allowed" })).toBeNull();
    expect(parseNote({ ...note("a1", 5), anchor: { kind: "word", unit: "17a" } })).toBeNull();
    expect(parseNote({ ...note("a1", 5), text: "x".repeat(10_001) })).toBeNull();
    expect(parseNotes([note("a1", 5), "junk", { id: 3 }])).toEqual([note("a1", 5)]);
    expect(parseNotes("not a list")).toEqual([]);
  });
});

describe("making two copies of the notes one", () => {
  it("keeps, for each note, the copy changed last", () => {
    const merged = mergeNotes([note("a1", 5, { text: "old" }), note("b2", 9)], [note("a1", 7, { text: "new" }), note("c3", 1)]);
    expect(merged.map((n) => [n.id, n.text])).toEqual([["a1", "new"], ["b2", "a note"], ["c3", "a note"]]);
  });
  it("lets a removal made later win over an older edit, and hides it", () => {
    const merged = mergeNotes([note("a1", 5)], [note("a1", 6, { deleted: true })]);
    expect(merged[0].deleted).toBe(true);
    expect(shown(merged)).toEqual([]);
  });
  it("sends only what the other copy lacks or holds older", () => {
    expect(newerThan([note("a1", 5), note("b2", 9), note("c3", 1)], [note("a1", 5), note("b2", 3)]).map((n) => n.id)).toEqual(["b2", "c3"]);
  });
});

describe("a note's place in words", () => {
  it("names a passage, a line and a word", () => {
    expect(placeName({ kind: "passage", unit: "17a" })).toBe("17a");
    expect(placeName({ kind: "line", unit: "1.5", line: 0, lines: 1 })).toBe("line 1.5");
    expect(placeName({ kind: "line", unit: "3", line: 1, lines: 4 })).toBe("3, line 2");
    expect(placeName({ kind: "word", unit: "17a", i: 2, word: "λόγος" })).toBe("λόγος in 17a");
  });
});

it("makes ids the database accepts, and different each time", () => {
  const a = newId(), b = newId();
  expect(a).toMatch(/^[a-z0-9]{24}$/);
  expect(a).not.toBe(b);
});
