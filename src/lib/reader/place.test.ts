import { beforeEach, describe, expect, it } from "vitest";
import { PLACES_KEY, forgetPlace, getPlace, recentPlaces, savePlace } from "./place";

// the browser's storage, in memory
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
});
beforeEach(() => store.clear());

describe("where you stopped in a book", () => {
  it("is kept and given back", () => {
    savePlace("tlg0059.tlg002", { at: "18", where: "Sections 17–22", book: "Plato, Apology" }, 5);
    expect(getPlace("tlg0059.tlg002")).toEqual({ at: "18", where: "Sections 17–22", book: "Plato, Apology", t: 5 });
    expect(getPlace("tlg0012.tlg001")).toBeNull();
  });
  it("lists the books you are reading, newest first", () => {
    savePlace("a", { at: "1", where: "p1", book: "A" }, 1);
    savePlace("b", { at: "2", where: "p1", book: "B" }, 3);
    savePlace("c", { at: "3", where: "p1", book: "C" }, 2);
    expect(recentPlaces(2).map(([w]) => w)).toEqual(["b", "c"]);
    forgetPlace("b");
    expect(recentPlaces().map(([w]) => w)).toEqual(["c", "a"]);
  });
  it("survives damaged storage", () => {
    localStorage.setItem(PLACES_KEY, "{not json");
    expect(getPlace("a")).toBeNull();
    expect(recentPlaces()).toEqual([]);
    localStorage.setItem(PLACES_KEY, JSON.stringify({ a: { at: 3 } }));
    expect(getPlace("a")).toBeNull();
  });
  it("keeps only the newest sixty books", () => {
    for (let i = 0; i < 65; i++) savePlace(`w${i}`, { at: "1", where: "p", book: "B" }, i);
    expect(Object.keys(JSON.parse(localStorage.getItem(PLACES_KEY)!))).toHaveLength(60);
    expect(getPlace("w0")).toBeNull();
    expect(getPlace("w64")).not.toBeNull();
  });
});
