# The reader, new against old

Compared on 12 Nov 2026: the new reader (this folder, built and served locally) against the old one on the live site, on Plato's
Apology, at 1440 px and 390 px, in Paper and Night. The screenshots are in `screenshots/new` and `screenshots/old`. They were
made with `node scripts/shots.mjs`.

## ADR 0009, decision by decision

| Decision | Old | New |
|---|---|---|
| 1. One look-up place per device | Window over the right margin from 1100 px; sheet below | The same. The window lines up with the type area's right edge, as the old one does. |
| 1. The look-up never covers the line | Checked by `check-lookup.mjs` | Checked by `e2e/reader.spec.ts` on five words, including the last word of the page, at both widths. The test was shown to fail when the sheet or the window is moved over the word. |
| 2. Greek alone, "Show the English" per passage | Yes | Yes. The English opens under its Greek with its credit line. Aa still offers Both and English. |
| 3. A book opens on its text | Title page the first time, then a one-line title | The same, including ΠΛΑΤΩΝ in Greek capitals from Wikidata's names. |
| 4. Two layers | Layer 1: form, kind, meaning, role, grammar. Layer 2: LSJ, Go further, Wiktionary, how sure, credits. | Layer 1 is the same, plus a plain line when the analysis is not of this exact word. Layer 2 has LSJ, how often the word occurs in the book, how sure, and credits. |
| 5. The reader's own foot bar | Library, where you are, Text, Study | Library, where you are, Text. There is no Study: its tools are outside version 1. |
| 6. Greek in Gentium Book Plus | Yes | Yes |
| 7. One panel shell, one button set | Yes | Yes. There is one menu shell, and the old button set is copied. |

## Where the new reader is better

- **The phone look-up shows the form without scrolling.** The old sheet cut off after the meaning, so the grammar ("perfect
  active indicative, 1st person singular") needed a scroll. The new sheet grows to fit its first layer, up to 45% of the screen,
  and keeps the word above it.
- **Uncertain analyses are flagged on the card itself.** When GLAUx's analysis is matched to the passage rather than to this
  exact word, or comes from elsewhere in the book, layer 1 says so. The old reader said it only in layer 2.
- **Short LSJ entries show whole.** The old faded preview and "The whole entry" appear only when the entry is cut off.
- **No letter falls back to another typeface.** The Apology's heading spells Ἀ as two code points, which the old reader drew in
  Times New Roman. Greek quoted in the English was drawn in Times New Roman too. The new reader draws both in Gentium, and
  `scripts/check-design.mjs` confirms every letter is in the three typefaces.
- **The meaning in the phone sheet is a step of the type scale.** The old one was 20.6 px, which was off the scale.
- **Lighter and faster** on a slow phone (`scripts/weigh.mjs`: 390 px, "slow 4G", processor slowed 4 times, empty cache, middle
  of three runs):

  | | New | Old |
  |---|---|---|
  | First Greek word on screen | 5.8 s | 7.1 s |
  | Bytes by then | 702 KB | 956 KB |
  | of which program code | 154 KB | 338 KB |
  | of which styles | 8 KB | 63 KB |
  | of which fonts | 169 KB | 210 KB |
  | Look-up ready after the tap | 1.6 s | 2.1 s |
  | Everything, after the first look-up | 859 KB | 1,160 KB |

## Where the new reader is worse, or not yet equal

- **The catalogue costs 243 KB before any text loads.** The reader reads it only to find the Apology's file on GitHub. Most of
  the remaining load time on a phone is this file. A small per-book index made at build time would remove it, but that is a
  copy of the catalogue's data, which the brief rules out. I have left it, and the question is open.
- **No dragging the phone sheet** between three heights, and no swiping for the next word. Previous and Next do the same job.
- **No "Go to" field for typing a reference.** The page list and links such as `&at=29` cover the slice. A typed reference can
  come with the library's search.
- **What version 1 leaves out on purpose:** Study and its tools, Wiktionary, Word Study, Echoes, the sentence view, the map,
  lessons, colour by case, metre, Listen, offline copies, two books side by side.

## Visual bugs found in review and fixed

- A hairline ran above the first passage.
- The look-up window stood short of the type area's right edge.
- Greek in the English, and the heading's Ἀ, were drawn in Times New Roman.
- The phone's passage-number column was wider than the old one's.
- The phone sheet hid the role and grammar lines.
- Short LSJ entries were faded as if cut off.
- "17a" was repeated at the start of the English beside passage 17.
