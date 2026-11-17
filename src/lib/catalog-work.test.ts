import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalog } from "./catalog";

// loadWorkCatalog: a book opens on its own entry (public/catalog/<work>.json), not the whole catalogue
const work = (id: string) => ({ id, title: id, lang: "grc", texts: [] });
const whole: Catalog = {
  built: "b", collections: {} as Catalog["collections"],
  authors: [{ id: "tlg0059", name: "Plato", works: [work("tlg0059.tlg002"), work("tlg0059.tlg030")] }],
};
const one: Catalog = { ...whole, authors: [{ ...whole.authors[0], works: [work("tlg0059.tlg002")] }] };

let asked: string[];
const serve = (entries: Record<string, Catalog>) =>
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    asked.push(url);
    const hit = Object.entries(entries).find(([end]) => url.endsWith(end));
    return hit ? new Response(JSON.stringify(hit[1])) : new Response("", { status: 404 });
  }));

beforeEach(() => { asked = []; vi.resetModules(); });
afterEach(() => vi.unstubAllGlobals());

describe("one work's entry", () => {
  it("is read alone, without the whole catalogue", async () => {
    serve({ "/catalog/tlg0059.tlg002.json": one, "/data/catalog.json": whole });
    const { loadWorkCatalog } = await import("./catalog");
    const idx = await loadWorkCatalog("tlg0059.tlg002");
    expect(idx.work.get("tlg0059.tlg002")?.id).toBe("tlg0059.tlg002");
    expect(idx.authorOf.get("tlg0059.tlg002")?.name).toBe("Plato");
    expect(asked).toEqual(["/catalog/tlg0059.tlg002.json"]);
  });
  it("gives way to the whole catalogue when that is already loaded", async () => {
    serve({ "/catalog/tlg0059.tlg002.json": one, "/data/catalog.json": whole });
    const { loadCatalog, loadWorkCatalog } = await import("./catalog");
    await loadCatalog();
    const idx = await loadWorkCatalog("tlg0059.tlg002");
    expect(idx.work.has("tlg0059.tlg030")).toBe(true);
    expect(asked).toEqual(["https://mathesisstoicheion.com/data/catalog.json"]);
  });
  it("falls back to the whole catalogue for a work with no entry of its own", async () => {
    serve({ "/data/catalog.json": whole });
    const { loadWorkCatalog } = await import("./catalog");
    const idx = await loadWorkCatalog("tlg0059.tlg030");
    expect(idx.work.get("tlg0059.tlg030")?.id).toBe("tlg0059.tlg030");
    expect(asked).toEqual(["/catalog/tlg0059.tlg030.json", "https://mathesisstoicheion.com/data/catalog.json"]);
  });
});
