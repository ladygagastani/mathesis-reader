/**
 * Corpus health check: parse every text in the catalogue and report problems.
 * Needs the corpus downloaded by pipeline/fetch_corpus.py. Run with:  CORPUS=1 npx vitest run src/lib/tei/corpus.test.ts
 * Writes pipeline/.cache/corpus-report.json.
 */
import { it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseTei } from "./parse";
import { translationPieces, placePieces } from "./align";
import { indexCatalog, greekEditions, type Catalog } from "@/lib/catalog";
import type { TeiDoc } from "./types";

const CACHE = "../pipeline/.cache/corpus";

it.skipIf(!process.env.CORPUS)("every text parses into citable passages", () => {
  const idx = indexCatalog(JSON.parse(readFileSync("public/data/catalog.json", "utf8")) as Catalog);
  const report: Record<string, unknown>[] = [];
  const docs = new Map<string, TeiDoc>();
  const load = (col: string, path: string) => {
    const f = `${CACHE}/${col}/${path}`;
    return existsSync(f) ? parseTei(readFileSync(f, "utf8")) : null;
  };

  for (const a of idx.catalog.authors) for (const w of a.works) {
    const ed = greekEditions(w).find((t) => t.col === "perseus") ?? greekEditions(w)[0];
    for (const t of w.texts) {
      if (t.lang !== "grc" && t.lang !== "eng") continue;
      let d: TeiDoc | null;
      try { d = load(t.col, t.path); } catch (e) { report.push({ urn: t.urn, problem: "parse error", detail: (e as Error).message }); continue; }
      if (!d) continue;
      if (t === ed) docs.set(w.id, d);
      const keys = d.units.map((u) => u.ref.join("."));
      const empty = d.units.filter((u) => u.ref.length !== d!.levels.length || u.ref.some((r) => !r)).length;
      const dupes = keys.length - new Set(keys).size;
      const noText = d.units.filter((u) => !u.blocks.some((b) => b.c.some((x) => typeof x === "string" && x.trim()))).length;
      const biggest = Math.max(0, ...d.chunks.map((c) => c.last - c.first + 1));
      const entry: Record<string, unknown> = { urn: t.urn, kind: t.kind, levels: d.levels.join("."), units: d.units.length, chunks: d.chunks.length, biggest };
      const problems: string[] = [];
      if (!d.units.length) problems.push("no passages");
      if (empty) problems.push(`${empty} passages without a full reference`);
      if (dupes > keys.length * 0.02) problems.push(`${dupes} repeated references`);
      if (noText > d.units.length * 0.2) problems.push(`${noText} passages with no text`);
      if (biggest > 3000) problems.push(`a page of ${biggest} passages`);
      if (problems.length) entry.problems = problems;
      report.push(entry);
    }
  }

  // how much of each Greek text its English translations line up with
  for (const a of idx.catalog.authors) for (const w of a.works) {
    const g = docs.get(w.id);
    if (!g) continue;
    for (const t of w.texts.filter((x) => x.kind === "translation" && x.lang === "eng")) {
      const tr = load(t.col, t.path);
      if (!tr || !tr.units.length) continue;
      const placed = placePieces(g, translationPieces(g, tr));
      const anchored = new Set(placed.map((p) => p.at)).size;
      const entry = report.find((r) => r.urn === t.urn)!;
      entry.anchors = anchored;
      entry.share = +(anchored / Math.max(1, g.units.length)).toFixed(3);
      if (anchored <= 1 && g.units.length > 20) entry.problems = [...((entry.problems as string[]) ?? []), "translation lines up only at the start"];
    }
  }

  const bad = report.filter((r) => r.problems);
  writeFileSync("../pipeline/.cache/corpus-report.json", JSON.stringify({ checked: report.length, withProblems: bad.length, report }, null, 1));
  console.log(`checked ${report.length} texts, ${bad.length} with problems`);
}, 3_600_000);
