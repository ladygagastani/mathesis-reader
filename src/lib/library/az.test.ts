import { describe, expect, it } from "vitest";
import { fold } from "@/lib/greek";
import { azKey, bestMatch, compareAZ, groupAZ, nameMatch } from "./az";

describe("A to Z order", () => {
  it("files a title under its first Latin letter, skipping numbers, brackets, accents and a leading article", () => {
    expect(azKey("Iliad")).toBe("I");
    expect(azKey("éloge")).toBe("E");
    expect(azKey("1 Corinthians")).toBe("C");
    expect(azKey("(Sophonias) Commentary on the Parva Naturalia")).toBe("C");
    expect(azKey("The Gospel of John")).toBe("G");
    expect(azKey("A True Story")).toBe("T");
    expect(azKey("An Ethiopian Story")).toBe("E");
    expect(azKey("Theogony")).toBe("T");
    expect(azKey("Anabasis")).toBe("A");
    expect(azKey("Against Timarchus")).toBe("A");
  });

  it("puts titles that do not start with a Latin letter under #", () => {
    expect(azKey("Ἰλιάς")).toBe("#");
    expect(azKey("")).toBe("#");
    expect(azKey("123")).toBe("#");
  });

  it("sorts A to Z, then #, ignoring capitals and putting numbers in order of size", () => {
    const titles = ["Ἰλιάς", "oration 10", "Oration 2", "Against Timarchus", "1 Corinthians", "Apology"];
    expect([...titles].sort(compareAZ)).toEqual(["Against Timarchus", "Apology", "1 Corinthians", "Oration 2", "oration 10", "Ἰλιάς"]);
  });

  it("orders titles by the words they are filed by", () => {
    const titles = ["The Trojan Women", "Theogony", "A True Story", "Thebaid", "The Deipnosophists", "2 Peter", "1 Peter", "Peace"];
    expect([...titles].sort(compareAZ)).toEqual(["The Deipnosophists", "Peace", "1 Peter", "2 Peter", "Thebaid", "Theogony", "The Trojan Women", "A True Story"]);
  });

  it("groups catalogue titles into one part per letter, A to Z in order", () => {
    // real titles from the catalogue, chosen for the cases that filing must handle (the catalogue itself is not kept here)
    const titles = ["The Alexiad", "The First Tetralogy", "The Second Tetralogy", "A Short Account of Geography", "1 Corinthians",
      "2 Corinthians", "(Sophonias) Commentary on the Parva Naturalia", "Symposium", "Iliad", "Odyssey", "Apology", "Zeus Catechized", "Ἰλιάς"];
    const items = titles.map((title) => ({ title }));
    const keys = groupAZ(items).map((g) => g.key);
    expect(keys).toEqual(["A", "C", "F", "I", "O", "S", "Z", "#"]);
    expect(keys[0]).toBe("A");
    expect(new Set(keys).size).toBe(keys.length);            // no letter twice
    expect([...keys].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a < b ? -1 : 1))).toEqual(keys);
  });

  it("groups the sorted items by letter, leaving out letters with nothing", () => {
    const g = groupAZ([{ title: "Odyssey" }, { title: "Iliad" }, { title: "Ἰλιάς" }, { title: "Hymns" }, { title: "Iliad, book 1" }]);
    expect(g.map((x) => x.key)).toEqual(["H", "I", "O", "#"]);
    expect(g[1].items.map((x) => x.title)).toEqual(["Iliad", "Iliad, book 1"]);
  });

  it("does not change the list it is given", () => {
    const items = [{ title: "B" }, { title: "A" }];
    groupAZ(items);
    expect(items.map((x) => x.title)).toEqual(["B", "A"]);
  });
});

describe("the best match for a search", () => {
  it("tells a whole name from the start of one, of a word in one, and from the middle of one", () => {
    expect(nameMatch(["Plato"], "plato")).toBe(0);
    expect(nameMatch(["Aristotle"], "aristot")).toBe(1);
    expect(nameMatch(["Pseudo-Plato"], "plato")).toBe(2);
    expect(nameMatch(["Elias Neoplatonicus"], "plato")).toBe(3);
    expect(nameMatch(["Homer"], "plato")).toBe(-1);
  });

  it("ignores accents, capitals and names that are missing, and takes the closest of an author's names", () => {
    expect(nameMatch(["Albinus", undefined, "Albino platonico"], "platon")).toBe(2);
    expect(nameMatch(["Ἀριστοτέλης", "Aristotle"], fold("αριστοτελης"))).toBe(0);
    expect(nameMatch(["Plato Philosophus", "Platon"], "platon")).toBe(0);
  });

  it("picks an item only when it alone is closest", () => {
    const tiers: Record<string, number> = { Plato: 0, "Pseudo-Plato": 2, Albinus: 2, Cato: -1 };
    expect(bestMatch(Object.keys(tiers), (x) => tiers[x])).toBe("Plato");
    expect(bestMatch(["Marcus Aurelius", "Marcus Argentarius"], () => 1)).toBeNull();
    expect(bestMatch(["Cato"], (x) => tiers[x])).toBeNull();
    expect(bestMatch([], () => 0)).toBeNull();
    // "Anonymous" alone, but also the start of many others' names: no one in particular
    expect(bestMatch(["Anonymous", "Anonymous of Byzantium", "Anonymous Seguerianus", "Anonymous on Rhetoric", "Anonymi Comment"], (x) => (x === "Anonymous" ? 0 : 1))).toBeNull();
    expect(bestMatch(["Homer", "Homeric Hymns"], (x) => (x === "Homer" ? 0 : 1))).toBe("Homer");
  });
});
