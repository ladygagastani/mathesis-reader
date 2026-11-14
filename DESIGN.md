# Design: Tondo

The look of Mathesis Reader from 14 November 2026. It replaces the printed-page look of 12 November (warm paper, red, EB
Garamond, Gentium and GFS Didot), which is in git history and is a reference only. The owner chose Tondo from six
directions drawn on the same page of the Apology; the mock-ups are in [docs/directions](docs/directions), and Tondo's is
[e-tondo.html](docs/directions/e-tondo.html).

## The idea

An Attic drinking cup, a kylix, has one painted circle at the bottom of its bowl, the tondo, ringed by a band of
tongues. You see it as you drink. Tondo makes the reader that cup: black glaze, the text in the colour of the clay, and
a ring of terracotta tongues around the two things that matter, the book's title when it opens and every word you look
up. The Greek is the beauty of the page and the look-up is its moment; the ornament marks only those two, so the
reading itself stays calm.

Three rules keep it calm for long reading:

1. **Ornament never enters running text.** The rings, the tongue band and the number rings stand on the title page, in
   the look-up and in the passage rail. A line of Greek or English has nothing drawn on it but the looked-up word's tint.
2. **One colour.** Terracotta is the only colour beside the ink: the ornament, the passage numbers, links, the chosen
   thing and the main button. The notes' four colours are the one exception, and only where a note is.
3. **Night is the home page; Day is its daylight copy.** Both are drawn from the same vase: Night is black glaze with
   clay letters (red-figure), Day is pale clay with black letters (black-figure). The device's dark or light mode picks
   one unless the reader does.

## Hard limit: polytonic Greek

Every typeface that sets Greek must draw every precomposed polytonic letter: all of Greek Extended (U+1F00 to U+1FFE)
and the accented letters of basic Greek, with the elision mark ʼ (U+02BC) and the ano teleia. Checked 2026-11-13 by
measuring each letter against two fallbacks in Chrome: Literata and Noto Serif Display pass. The texts are NFC, so the
combining breathings (U+0313, U+0314, U+0342) are not needed; Google's Greek files leave them out, and a text that needs
them must be normalised to NFC first. Hanken Grotesk has no Greek at all and never sets it: every font list that starts
with it falls back to Literata, so a Greek word inside a label is drawn in Literata. Literata comes before the
"Hanken Grotesk Fallback" face that next/font makes from Arial; after it, every Greek letter in a label was drawn in
Arial. A character none of the three has, such as "←", is drawn as an icon instead.

## Typefaces

| Face | Role | Weights |
|---|---|---|
| **Literata** | The Greek being read, the English beside or under it, the look-up's Greek | 400, 500; italic 400 |
| **Noto Serif Display** | The book's title, the dictionary form in the look-up, the meaning, passage numbers | 300, 400 |
| **Hanken Grotesk** | The bar, buttons, menus, labels, counts | 400, 500 |

Three and no more. All three are SIL Open Font License, served from the app (next/font), never from Google at reading
time. Figures are lining and tabular in counts and passage numbers, old-style in running English.

## Type

| Token | Size | Line height | Use |
|---|---|---|---|
| `--t-label` | 13 px | 1.3 | Labels in capitals spaced 0.14 em (Hanken 500), counts |
| `--t-small` | 15 px | 1.5 | Second lines, the look-up's grammar, credits |
| `--t-ui` | 16 px | 1.4 | The bar, buttons, menus, list rows |
| `--t-body` | 19 px | 1.6 | English prose, the English beside or under the Greek (Literata) |
| `--t-lead` | 24 px | 1.25 | A part's heading; the meaning in the phone's sheet; a long meaning in the panel |
| `--t-head` | 32 px | 1.15 | The meaning in the panel (Noto Serif Display 300 in Night, 400 in Day), a page's second heading |

A meaning of more than 34 letters steps down one size (32 px to 24 px in the panel, 24 px to 19 px in the sheet), so the
look-up's first line never runs past three lines.
| `--t-title` | 40 px | 1.1 | A page's title; the dictionary form (Noto Serif Display 400) |
| `--t-display` | 48 px | 1.08 | The book's title inside the title tondo |

The Greek being read is 22 px on a computer (Literata's x-height is large; 22 px reads as Gentium's 24) with a line
height of 1.8, and falls to 19 px on a phone. Text still sets 18 to 34 px and 1.4 to 2.0.

## Colour

Components use only the role names. Every ink is at least 4.5 : 1 on its ground, the main button's letters included.

```css
/* Night: red-figure. The default in the device's dark mode. */
--bg: #0f0c0a;        /* black glaze */
--surface: #17120f;   /* the look-up's panel, the menus */
--ink: #eedcc6;       /* clay light: 14.6 : 1 (13.9 : 1 on --surface) */
--ink-2: #c7ad92;     /* 9.1 : 1 (8.7 : 1 on --surface) */
--ink-3: #97806a;     /* 5.2 : 1 (5 : 1 on --surface) */
--accent: #d77b4a;    /* terracotta: 6.3 : 1 (6 : 1 on --surface); --bg on it 6.3 : 1 */
--word-on: #2f1e14;   /* behind the looked-up word: terracotta at 16 % */
--line: rgb(215 123 74 / 0.34); /* ornament hairlines */

/* Day: black-figure. The default in the device's light mode. */
--bg: #efe1cd;        /* pale fired clay */
--surface: #e6d4bb;
--ink: #1b130d;       /* black glaze: 14.3 : 1 (12.7 : 1 on --surface) */
--ink-2: #4c3b2c;     /* 8.3 : 1 (7.4 : 1 on --surface) */
--ink-3: #6b5440;     /* 5.5 : 1 (4.9 : 1 on --surface) */
--accent: #933d19;    /* terracotta, fired darker: 5.6 : 1 (5 : 1 on --surface); --bg on it 5.6 : 1 */
--word-on: #e1c5ae;
--line: rgb(147 61 25 / 0.38);
```

The notes keep four colours, re-tuned to sit on each ground at 4.5 : 1 or more.

## Ornament

All drawn in SVG from one component, `Ring`, which measures the box it surrounds and fits a whole number of tongues
round it. A square box gets a circle; a wider one a stadium (a pill). Every ornament is `aria-hidden`.

- **The title tondo.** The first time a book opens, its title page stands in a circle 440 px across (300 px on a
  phone): a hairline, a band of tongues, a hairline, a ring of dots, then the author in spaced capitals, the Greek title
  in Noto Serif Display, the English title in italic.
- **The word's ring.** In the look-up the dictionary form stands in a smaller ring of the same tongues: a circle for a
  word of five letters or fewer, a stadium for a longer one. A long word is set smaller down to 24 px, then the ring
  grows, so a word is never cut or broken. On a short screen (under 520 px tall) the sheet drops the ring so the
  meaning comes first.
- **The tongue band.** A strip of tongues 10 px tall along the top edge of the look-up's panel and sheet.
- **The page marker.** In the bar, beside "page 1 of 5", a short row of tongues, one for each page, the pages up to this
  one in terracotta. A book of more than 12 pages gets a thin line that fills instead. (A ring was tried first, whole
  and in pieces; either way it read as something loading.)
- **The number ring.** Each passage number stands in a hairline circle with a dotted circle inside it.

Tongues alternate full terracotta and terracotta at 40 %. Hairlines are `--line`.

## Shape and space

Spacing steps of 4, 8, 12, 16, 24, 32, 48 and 64 px, as before. Corners: buttons, the grammar's parts and the looked-up
word's tint are pills (`--pill`); menus and the phone's sheet are rounded 12 px and 24 px (`--radius`); the panel and the
bar are square, edge to edge. No shadows: the panel and menus are `--surface` with a hairline edge. The bar is the page
ground at 90 % over a 12 px blur, with a hairline under it.

## Motion

Motion says where a thing came from, then stops. Nothing moves while you read.

- **The look-up opens:** it opens dozens of times a session, so its motion stays under 300 ms. On a computer the panel
  slides in from the right in 280 ms and the text moves aside in the same 280 ms, both on the drawer curve
  (`--ease-drawer`, cubic-bezier(0.32, 0.72, 0, 1)); on a phone the sheet rises from the foot in 320 ms. The word's ring
  turns 12° into place and fades in over 280 ms, starting 40 ms in; the dictionary form rises 6 px over 200 ms. Opening
  another word changes only the contents, so stepping from word to word, a keyboard action, never animates.
- **Pressing:** a button sinks to 97 % of its size while pressed (100 ms).
- **Hover:** colour only, 150 ms. Nothing lifts.
- **Arriving:** a menu or a second layer rises 6 px and fades in over 240 ms. The old ink-in blur is gone.
- **Reduced motion:** nothing moves. Each arrival becomes a 150 ms fade in place, colour changes stay gradual, and a
  press no longer sinks.

## Touch

Every control is at least 44 px tall on a touch screen and 40 px with a mouse. A control drawn smaller (the passage
number's 34 px ring on a phone) has an invisible pressable area that reaches 44 px. The look-up's buttons are 46 px pills; the passage number's ring is the number's button, and its
pressable area reaches past the ring to 44 px.

## Layouts

The structure of the 12 November design stays; only the look above changes.

1. **The look-up slides in from the right** on a computer: 400 px wide, under the bar, as tall as the window. Where
   the text fits beside it, the text moves aside; where it does not, the panel lies over the English or, failing that,
   the look-up is a sheet from the foot of the screen (always below 760 px). × or Escape closes it.
2. **The text column is centred**, about 60 letters of Greek a line, with the passage numbers in a rail at its left.
3. **One bar, at the top**, on every page: Library, the book and its place (a row of tongues, one to a page), Notes,
   Text.

### Reader on a computer

```
| ‹ Library   Ἀπολογία · Plato   17-22 ▮▯▯▯▯ page 1 of 5  Notes  Text |  60 px, ground at 90 %, blur
|                                                                  |
|            ( ring of tongues: ΠΛΑΤΩΝ / Ἀπολογία Σωκράτους )        |  title page, first visit only
|                                                                  |
|   (17)  ὅτι μὲν ὑμεῖς, ὦ ἄνδρες Ἀθηναῖοι, πεπόνθατε    | ▮▯▮▯▮▯▮▯▮▯▮▯▮▯▮ |
|         ὑπὸ τῶν ἐμῶν κατηγόρων, οὐκ (οἶδα)· ἐγὼ δʼ οὖν | ( οἶδα )  ×     |
|         ...                                           | VERB · IRREGULAR|
|         ── Show the English                           | to know         |
```

### Reader on a phone

The bar at the top, the text in one column with the number's ring above each passage, and the look-up as a sheet
rising over the lower 58 % with the tongue band along its rounded top. The text scrolls so the word stays above it.

## Words in the look-up

The dictionaries' shorthand is written out in full: "to know (pf. in pres. sense)" is shown as "to know (perfect in
present sense)" (`lib/lookup/abbrev.ts`), in the look-up and on the Saved page. Marking each abbreviation with a dotted
line was tried first; at 32 px the dotted lines were the loudest thing in the panel.

A screen reader hears the word and its meaning once when a word opens or the arrows step to the next ("οἶδα: to know
..."), from one hidden live line. The card itself is not live, so it is not read out again at every step.

## Checks

- `scripts/check-design.mjs`: only the three typefaces, only the type steps, only the role colours, one filled button
  (a quiet button on the second surface also passes). It groups the words by their font settings and draws each
  group's letters once, so all 110 screens take about 5 minutes; each screen has a 90 second limit and is named on
  stderr as it starts. `ONLY=<screen names as a pattern>` and `THEME=paper|night` run a part of it.
- `scripts/check-a11y.mjs`: names, focus, contrast in Day and Night, 44 px targets.
- `scripts/check-impeccable.mjs`: impeccable's pattern detector over the source and the rendered library and reader,
  in `npm run check:design`. It first proves itself on a known-bad page. One finding is judged right and listed in the
  script with its reason: the author's spaced capitals above the title in the title tondo, flagged as a "kicker".
