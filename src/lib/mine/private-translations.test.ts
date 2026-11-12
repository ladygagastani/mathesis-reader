/**
 * The private translations' file check and markup (private-translations.ts), lifted from the old app. Made-up placeholder text only: no translation may ever be in this repository.
 */
import { describe, expect, it } from "vitest";
import { FORMAT, ID_PATTERN, checkTranslation, hasPublished, isIsoDate, parseRich, plainText, workOf, type RichNode, type TranslationDoc } from "./private-translations";

/** The smallest translation the check accepts. */
const minimal = () => ({
  format: FORMAT,
  id: "placeholder-work",
  author: "Placeholder Author",
  title: "Placeholder Title",
  status: "draft",
  passages: [{ rows: [{ greek: "λόγος ἐστί", english: "Placeholder sentence one." }] }],
});

const ok = (input: unknown): TranslationDoc => {
  const r = checkTranslation(input);
  if (!r.ok) throw new Error(`expected the check to pass, got: ${r.problems.join(" | ")}`);
  return r.doc;
};
const problems = (input: unknown): string[] => {
  const r = checkTranslation(input);
  if (r.ok) throw new Error("expected the check to fail");
  return r.problems;
};
/** A copy of the minimal translation with some fields changed (undefined removes a field). */
const withFields = (changes: Record<string, unknown>) => {
  const d: Record<string, unknown> = { ...minimal(), ...changes };
  for (const k of Object.keys(changes)) if (changes[k] === undefined) delete d[k];
  return d;
};

describe("checking a translation file", () => {
  it("accepts the smallest translation, keeping the file's own object to save as it is", () => {
    const input = minimal();
    const r = checkTranslation(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.raw).toBe(input);
    expect(r.warnings).toEqual([]);
    expect(r.doc).toEqual({
      format: FORMAT, id: "placeholder-work", author: "Placeholder Author", title: "Placeholder Title", status: "draft",
      passages: [{ rows: [{ greek: "λόγος ἐστί", english: "Placeholder sentence one." }] }],
    });
  });

  it("keeps every optional field, and drops optional text left empty", () => {
    const doc = ok({
      ...minimal(),
      greekTitle: "Λόγος", updated: "2026-10-13", urn: "urn:cts:greekLit:tlg9999.tlg001", greekEdition: "Placeholder edition",
      publishedTranslation: "", intro: "Placeholder introduction.",
      passages: [{
        heading: "Placeholder heading", locator: "  ",
        rows: [{ ref: " 1.1 ", greek: "λόγος ἐστί", english: "Placeholder sentence one.", published: "Placeholder sentence two." }],
        notes: ["Placeholder note.", ""],
        differences: [{ greek: "λόγος", published: "word", ours: "account", why: "Placeholder reason." }],
      }],
    });
    expect(doc.greekTitle).toBe("Λόγος");
    expect(doc.updated).toBe("2026-10-13");
    expect(doc.urn).toBe("urn:cts:greekLit:tlg9999.tlg001");
    expect(doc.greekEdition).toBe("Placeholder edition");
    expect(doc.intro).toBe("Placeholder introduction.");
    expect("publishedTranslation" in doc).toBe(false);
    const p = doc.passages[0];
    expect(p.heading).toBe("Placeholder heading");
    expect("locator" in p).toBe(false);
    expect(p.rows[0]).toEqual({ ref: "1.1", greek: "λόγος ἐστί", english: "Placeholder sentence one.", published: "Placeholder sentence two." });
    expect(p.notes).toEqual(["Placeholder note."]);
    expect(p.differences).toEqual([{ greek: "λόγος", published: "word", ours: "account", why: "Placeholder reason." }]);
  });

  it("takes a row's label, shown in the margin instead of its reference, and lets rows share a reference", () => {
    const doc = ok({
      ...minimal(),
      urn: "urn:cts:greekLit:tlg9999.tlg001",
      passages: [{
        rows: [
          { ref: "1.7", label: " 1a10 ", greek: "λόγος ἐστί", english: "Placeholder sentence one." },
          { ref: "1.7", label: "1a15", greek: "ἄλφα βῆτα", english: "Placeholder sentence two." },
          { ref: "1.7", greek: "γάμμα", english: "Placeholder sentence three." },
          { label: "only a label", greek: "δέλτα", english: "Placeholder sentence four." },
        ],
      }],
    });
    const rows = doc.passages[0].rows;
    expect(rows[0].ref).toBe("1.7");
    // the reader link still goes by the reference, not the label
  });

  it("names a row by its label, else its reference, when something is wrong in it", () => {
    const ps = problems({
      ...minimal(),
      passages: [{
        rows: [
          { ref: "1.7", label: "1a10", greek: "λόγος", english: "Placeholder." },
          { ref: "1.7", label: "1a15", greek: "λόγος" },
          { ref: "2.1", english: "Placeholder." },
          { greek: "λόγος", english: "Placeholder.", label: 7 },
        ],
      }],
    });
    expect(ps).toEqual([
      `Passage 1, row 2 (1a15): our English ("english") is missing.`,
      `Passage 1, row 3 (2.1): the Greek ("greek") is missing.`,
      `Passage 1, row 4: the label ("label") must be text in "quotation marks" (found the number 7).`,
    ]);
  });

  it("says, in plain words, what is missing at the top", () => {
    expect(problems({})).toEqual([
      `The format ("format") is missing: the file should say "format": "${FORMAT}", so the page knows how to read it.`,
      `The id ("id") is missing.`,
      `The author ("author") is missing.`,
      `The title ("title") is missing.`,
      `The status ("status") is missing: it should be "sample", "draft", "complete" or "imported".`,
      `The passages ("passages") are missing: a translation needs at least one passage.`,
    ]);
  });

  it("refuses a wrong format, id or status, and empty or wrongly typed text", () => {
    expect(problems(withFields({ format: "mathesis-translation/2" }))).toEqual([
      `The format ("format") is "mathesis-translation/2", but this page reads only "${FORMAT}".`,
    ]);
    expect(problems(withFields({ id: "Placeholder Work" }))[0]).toMatch(/only lowercase letters, digits and hyphens/);
    expect(problems(withFields({ id: "a".repeat(81) }))).toEqual([`The id ("id") is 81 characters long; it may be at most 80.`]);
    expect(ok(withFields({ id: "a".repeat(80) })).id).toHaveLength(80);
    expect(problems(withFields({ status: "finished" }))).toEqual([
      `The status ("status") must be "sample", "draft", "complete" or "imported" (found "finished").`,
    ]);
    expect(problems(withFields({ title: "   " }))).toEqual([`The title ("title") is empty.`]);
    expect(problems(withFields({ author: 4.1 }))).toEqual([`The author ("author") must be text in "quotation marks" (found the number 4.1).`]);
    expect(problems(withFields({ intro: ["x"] }))).toEqual([
      `The introduction ("intro") must be text in "quotation marks" (found a list in [ square brackets ]).`,
    ]);
  });

  it("checks the passages and their rows", () => {
    expect(problems(withFields({ passages: [] }))).toEqual([`The list of passages ("passages") is empty: a translation needs at least one passage.`]);
    expect(problems(withFields({ passages: {} }))).toEqual([`The passages ("passages") must be a list in [ square brackets ] (found a group of fields in { curly brackets }).`]);
    expect(problems(withFields({ passages: ["x"] }))).toEqual([`Passage 1 must be a group of fields in { curly brackets } (found "x").`]);
    expect(problems(withFields({ passages: [{}] }))).toEqual([`Passage 1 has no rows ("rows"): each passage needs at least one row of Greek and English.`]);
    expect(problems(withFields({ passages: [{ rows: [] }] }))).toEqual([`Passage 1 has no rows ("rows"): each passage needs at least one row of Greek and English.`]);
    expect(problems(withFields({ passages: [{ rows: "λόγος" }] }))).toEqual([
      `Passage 1: the rows ("rows") must be a list in [ square brackets ] (found "λόγος").`,
    ]);
    expect(problems(withFields({ passages: [{ rows: [null] }] }))).toEqual([`Passage 1, row 1 must be a group of fields in { curly brackets } (found nothing (null)).`]);
  });

  it("checks notes and differences", () => {
    const base = { rows: [{ greek: "λόγος", english: "Placeholder." }] };
    expect(problems(withFields({ passages: [{ ...base, notes: ["Placeholder note.", 3] }] }))).toEqual([
      `Passage 1, note 2 must be text in "quotation marks" (found the number 3).`,
    ]);
    expect(problems(withFields({ passages: [{ ...base, notes: "Placeholder note." }] }))).toEqual([
      `Passage 1: the notes ("notes") must be a list in [ square brackets ] (found "Placeholder note.").`,
    ]);
    expect(problems(withFields({ passages: [{ ...base, differences: [{}] }] }))).toEqual([
      `Passage 1, difference 1 is empty: it has none of "greek", "published", "ours" or "why".`,
    ]);
    expect(problems(withFields({ passages: [{ ...base, differences: [{ why: true }] }] }))).toEqual([
      `Passage 1, difference 1: the reason ("why") must be text in "quotation marks" (found the word true).`,
    ]);
    const doc = ok(withFields({ passages: [{ ...base, differences: [{ ours: "Placeholder." }], notes: [] }] }));
    expect(doc.passages[0].differences).toEqual([{ ours: "Placeholder." }]);
    expect("notes" in doc.passages[0]).toBe(false);
  });

  it("ignores fields it does not know, and keeps them in the file's own object", () => {
    const input = { ...minimal(), extra: { anything: 1 }, passages: [{ colour: "red", rows: [{ greek: "λόγος", english: "Placeholder.", tone: 2 }] }] };
    const r = checkTranslation(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.passages[0].rows[0]).toEqual({ greek: "λόγος", english: "Placeholder." });
    expect((r.raw as { extra: unknown }).extra).toEqual({ anything: 1 });
  });

  it("warns, without refusing, about an unrecognised urn or a date not written year-month-day", () => {
    const r = checkTranslation(withFields({ urn: "tlg9999.tlg001", updated: "13 October 2026" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/urn/);
    expect(r.warnings[1]).toMatch(/year-month-day/);
  });

  it("refuses anything that is not one group of fields", () => {
    for (const x of [null, [], "text", 4]) expect(problems(x)[0]).toMatch(/^This file does not hold a translation/);
  });
});

describe("small helpers", () => {
  it("knows whether any row carries the published English", () => {
    expect(hasPublished(ok(minimal()))).toBe(false);
    expect(hasPublished(ok(withFields({ passages: [{ rows: [{ greek: "α", english: "a", published: "b" }] }] })))).toBe(true);
  });
  it("tells a year-month-day date", () => {
    expect(isIsoDate("2026-10-13")).toBe(true);
    expect(isIsoDate("2026-13-45")).toBe(false);
    expect(isIsoDate("13 October 2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
  it("uses the same rule for ids as the database", () => {
    expect(ID_PATTERN.test("placeholder-work-2")).toBe(true);
    for (const bad of ["", "Placeholder", "place holder", "placé", "a_b", "a".repeat(81)]) expect(ID_PATTERN.test(bad), bad).toBe(false);
  });
  it("finds the work and edition in a urn", () => {
    expect(workOf("urn:cts:greekLit:tlg9999.tlg001")).toEqual({ work: "tlg9999.tlg001", ed: null });
    expect(workOf(" urn:cts:greekLit:tlg9999.tlg001.placeholder-grc1 ")).toEqual({ work: "tlg9999.tlg001", ed: "placeholder-grc1" });
    expect(workOf("tlg9999.tlg001")).toBeNull();
    expect(workOf(undefined)).toBeNull();
  });
});

// ------------------------------------------------------------ the markup
/** The marks as a short string, to compare: [i:…], [+:…] for added words, / for a line break. */
const show = (ns: RichNode[]): string => ns.map((n) => (n.k === "text" ? n.s : n.k === "br" ? "/" : `[${n.k === "i" ? "i" : "+"}:${show(n.c)}]`)).join("");
const paras = (src: string | undefined) => parseRich(src).map(show);

describe("the light markup", () => {
  it("splits paragraphs at blank lines, keeps single line breaks, and trims", () => {
    expect(paras(undefined)).toEqual([]);
    expect(paras("")).toEqual([]);
    expect(paras("  Placeholder one.  ")).toEqual(["Placeholder one."]);
    expect(paras("Placeholder one.\n\nPlaceholder two.")).toEqual(["Placeholder one.", "Placeholder two."]);
    expect(paras("Placeholder one.\r\n \t\r\nPlaceholder two.\n\n\n")).toEqual(["Placeholder one.", "Placeholder two."]);
    expect(paras("line one\nline two")).toEqual(["line one/line two"]);
  });
  it("reads *words* as italics, and leaves a lone or doubled star as it is", () => {
    expect(paras("a *placeholder* word")).toEqual(["a [i:placeholder] word"]);
    expect(paras("*two words*")).toEqual(["[i:two words]"]);
    expect(paras("2 * 3 * 4")).toEqual(["2 * 3 * 4"]);
    expect(paras("a *lone star")).toEqual(["a *lone star"]);
    expect(paras("**not bold**")).toEqual(["**not bold**"]);
  });
  it("reads ⟦words⟧ as added later, inside or around italics, and leaves an unclosed bracket as it is", () => {
    expect(paras("λόγος ⟦ἐστί⟧")).toEqual(["λόγος [+:ἐστί]"]);
    expect(paras("⟦a *placeholder* word⟧")).toEqual(["[+:a [i:placeholder] word]"]);
    expect(paras("λόγος ⟦ἐστί")).toEqual(["λόγος ⟦ἐστί"]);
    expect(paras("λόγος⟧ ἐστί")).toEqual(["λόγος⟧ ἐστί"]);
    expect(paras("⟦⟧")).toEqual(["⟦⟧"]);
  });
  it("never reads HTML: the text stays text", () => {
    expect(paras("<b>placeholder</b>")).toEqual(["<b>placeholder</b>"]);
  });
  it("gives the bare words for matching", () => {
    expect(plainText(" ⟦λόγος⟧\n *ἐστί*  ")).toBe("λόγος ἐστί");
  });
});
