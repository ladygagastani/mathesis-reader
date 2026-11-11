/** Placing GLAUx's analysed words on the words of the text the reader shows. Shared by the index builder and the site. */

/**
 * Place GLAUx's words on the reader's words. Both are walked in reading order, allowing small
 * differences between the two editions (a word added, dropped or spelled differently). When they
 * drift apart (a passage one edition has and the other lacks, or a different order), the place is
 * found again by a run of five identical words, the occurrence nearest to where we were.
 * GLAUx's own references are not used: they often follow a different citation scheme.
 * Returns, for each GLAUx word, the position of the reader's word, or -1.
 */
export function alignStream(glaux: string[], tei: string[]): Int32Array {
  const N = 5, LOOK = 6;
  const at = new Int32Array(glaux.length).fill(-1);
  const used = new Uint8Array(tei.length);
  const grams = new Map<string, number[]>();
  for (let i = 0; i + N <= tei.length; i++) {
    const g = tei.slice(i, i + N).join(" ");
    const l = grams.get(g);
    if (l) l.push(i); else grams.set(g, [i]);
  }
  let p = 0;
  for (let t = 0; t < glaux.length; t++) {
    let hit = -1;
    for (let k = p; k < Math.min(tei.length, p + LOOK); k++) if (!used[k] && tei[k] === glaux[t]) { hit = k; break; }
    if (hit < 0) {
      const cands = grams.get(glaux.slice(t, t + N).join(" "));
      let best = Infinity;
      for (const c of cands ?? []) if (!used[c] && Math.abs(c - p) < best) { best = Math.abs(c - p); hit = c; }
    }
    if (hit < 0) continue;
    used[hit] = 1; at[t] = hit; p = hit + 1;
  }
  return at;
}
