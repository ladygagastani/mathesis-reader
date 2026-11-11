import { describe as group, expect, it } from "vitest";
import { describe, indexCatalog, type Catalog, type CatText } from "./catalog";
import { fold } from "./greek";

const t = (desc: string, urn = "urn:cts:greekLit:tlg0012.tlg001.perseus-eng4"): CatText =>
  ({ urn, kind: "translation", lang: "eng", label: "Iliad", desc, col: "perseus", path: "", size: 0, sha: "" });

group("catalogue helpers", () => {
  it("names a version by translator or editor and year of publication", () => {
    expect(describe(t("Homer. The Iliad of Homer. Butler, Samuel, 1835-1902, translator. London: Longmans, Green, and Co, 1898."))).toBe("Butler, 1898");
    expect(describe(t("Homer. The Iliad, Volume 1-2. Murray, A. T. (Augustus Taber), translator. London: William Heinmann, 1924-1925."))).toBe("Murray, 1924");
    expect(describe(t("Homer. Homeri Opera. Monro, D. B. (David Binning), editor; Allen, Thomas W., editor. Oxford: Clarendon Press, 1908-1920."))).toBe("Monro, 1908");
  });
  it("adds the file's own name only where two texts of the work would otherwise read the same", () => {
    const desc = "Plato. Opera. Burnet, John, 1863-1928, editor. Oxford, 1903.";
    const a = { ...t(desc, "urn:cts:greekLit:tlg0059.tlg030.perseus-grc1"), kind: "edition" as const, lang: "grc" };
    const b = { ...a, urn: "urn:cts:greekLit:tlg0059.tlg030.1st1K-grc1" };
    const eng = t("Plato. Republic. Burnet, John, 1863-1928, translator. 1903.", "urn:cts:greekLit:tlg0059.tlg030.perseus-eng1");
    // told the work's texts
    expect(describe(a, [a, b, eng])).toBe("Burnet, 1903 (perseus-grc1)");
    expect(describe(b, [a, b, eng])).toBe("Burnet, 1903 (1st1K-grc1)");
    // a translation that reads the same as an edition is still told apart by its kind
    expect(describe(eng, [a, b, eng])).toBe("Burnet, 1903");
    expect(describe(a, [a, eng])).toBe("Burnet, 1903");
    // not told: the catalogue loaded last is asked
    const cat: Catalog = { built: "", collections: {} as Catalog["collections"], authors: [{ id: "tlg0059", name: "Plato", works: [{ id: "tlg0059.tlg030", title: "Republic", lang: "grc", texts: [a, b, eng] }] }] };
    indexCatalog(cat);
    expect(describe(a)).toBe("Burnet, 1903 (perseus-grc1)");
    expect(describe(eng)).toBe("Burnet, 1903");
  });
  it("folds accents, breathings, case and final sigma for searching", () => {
    expect(fold("Λόγος")).toBe("λογοσ");
    expect(fold("ᾠδῇ")).toBe("ωδη");
  });
});
