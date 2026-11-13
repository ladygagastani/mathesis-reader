# Design

The look of Mathesis Reader on a computer, 1280 px wide and up. Every choice below serves two things: reading a long
passage of Greek without strain, and getting a word's meaning without losing your place. Phones and tablets come later.
Nothing here fixes a width that a phone layout would have to undo: the columns are a CSS grid that can fold to one.

What stays from the old look: warm paper and a night page, black ink, one red, hairline rules, square corners, no
shadows, and the three typefaces. They suit a printed Greek text and the readers already know them. What changes is
the layout, the type scale, and where the look-up stands.

## Five decisions

1. **The look-up slides in from the right.** A clicked word's entry opens in a panel 400 px wide that slides in from
   the window's right edge, under the bar and as tall as the window, with a hairline at its left. It never covers the
   Greek. Where the text column fits beside the panel with 32 px to spare on each side, the text moves aside, 200 px to
   the left, while the panel is open. With Greek and English side by side and no room for that, the panel lies over the
   English, as long as the Greek ends 32 px clear of it. Where neither works (narrower than about 1200 px with the Greek
   alone, and always below 760 px), the look-up is a low sheet from the foot of the screen. The panel scrolls inside
   itself, and × or Escape closes it. The note editor opens in the same panel. (Until 2026-11-12 the look-up stood in a
   desk column that was always there; the owner found it awkward to use. A card floating by the word followed for a
   day, and the owner preferred a panel from the right.)
2. **The text column is centred in the window,** at a measure of 30 em of Greek (about 60 letters a
   line, 680 px at 24 px). Passage numbers hang in a 56 px rail to its left.
3. **Greek is set at 24 px with a line height of 1.65.** A line now takes 40 px instead of 46 px, so a 900 px window
   holds 21 lines of Greek instead of 18, and Gentium's accents and breathings still clear the line above. Both stay adjustable in Text.
4. **One bar, at the top, on every page.** In the reader it holds Library, the book and page (which opens Go to), Notes
   and Text. On the other pages it holds Library, Saved, Sync, Private texts and a Paper/Night switch. Top, because on a
   computer a bar at the foot sits where the eye ends each screen of text. A phone can move it to the foot later.
5. **Labels in small capitals are spaced at 0.08 em, not 0.2 em,** and set at 13 px in the second ink. The old wide
   spacing at 12 px was hard to read in Night.

## Type

Three typefaces, as before: EB Garamond for English and the interface, Gentium Book Plus for all Greek, GFS Didot only
for the title page and the logo. Root size 16 px. Figures are old-style in running text and lining in tables and counts.

| Token | Size | Line height | Use |
|---|---|---|---|
| `--t-label` | 0.8125rem (13 px) | 1.3 | Small-capital labels, counts |
| `--t-small` | 0.9375rem (15 px) | 1.45 | Second lines in lists, credits, the look-up's grammar and sources |
| `--t-ui` | 1.0625rem (17 px) | 1.4 | Buttons, menus, list rows, the bar |
| `--t-body` | 1.1875rem (19 px) | 1.55 | English prose, the English beside or under the Greek, the look-up's meaning |
| `--t-greek` | 1.5rem (24 px) | 1.65 | The Greek being read. Text sets 18 to 34 px and 1.4 to 2.0 |
| `--t-lead` | 1.5rem (24 px) | 1.25 | The look-up's meaning, a part's heading |
| `--t-head` | 2rem (32 px) | 1.15 | The look-up's dictionary form (Gentium), a page's second heading |
| `--t-title` | 2.5rem (40 px) | 1.1 | A page's title |
| `--t-display` | 4rem (64 px) | 1.05 | The book's title page only (GFS Didot) |

The English under a passage moves from 16 px to `--t-body`, so the check you make against the English reads as easily
as the Greek.

## Colour

Two pages, Paper and Night. Paper follows the device's light mode and Night its dark mode, unless the site bar or Text
chooses one. Components use only the role names. Every ink is at least 4.5 : 1 on its page.

```css
:root, :root[data-theme="paper"] {
  --bg: #f4eee3;         /* the page */
  --surface: #ece4d5;    /* the look-up's panel, menus, the bar */
  --ink: #1f1b16;        /* text: 14.8 : 1 */
  --ink-2: #4a4036;      /* second lines, labels: 8.8 : 1 */
  --ink-3: #6b5d4d;      /* small print: 5.5 : 1 (5 : 1 on --surface) */
  --rule: rgb(31 27 22 / 0.16);
  --rule-strong: rgb(31 27 22 / 0.6);
  --accent: #a3301a;     /* red: passage numbers, links, the chosen thing: 6.1 : 1 */
  --word-on: #e5d7bc;    /* behind the word looked up */
  --note-red: #a3301a; --note-ochre: #855a0c; --note-green: #3d6635; --note-blue: #2d5585;
}
:root[data-theme="night"] {
  --bg: #191612;
  --surface: #221e19;
  --ink: #ece3d3;        /* 14.2 : 1 */
  --ink-2: #cdbfa8;      /* 10 : 1 */
  --ink-3: #a89a84;      /* 6.5 : 1 (6 : 1 on --surface) */
  --rule: rgb(236 227 211 / 0.14);
  --rule-strong: rgb(236 227 211 / 0.55);
  --accent: #e0805f;
  --word-on: #3c3328;
  --note-red: #e0805f; --note-ochre: #d9ad55; --note-green: #93c283; --note-blue: #93b5e3;
}
```

The same Night values apply under `@media (prefers-color-scheme: dark)` when no page is chosen. Red marks one kind of
thing at a time: the passage numbers in the text, links, and the chosen item in a list. The looked-up word gets
`--word-on` behind it and a 2 px `--accent` line under it, so it is found again at a glance after reading the entry.

## Space and shape

Spacing steps of 4, 8, 12, 16, 24, 32, 48 and 64 px (`--space-1` to `--space-8`). Hairline rules (1 px `--rule`), a strong
rule (`--rule-strong`) above each part of a page, square corners everywhere, the grammar tags included. No shadows: the
look-up's panel and menus sit on `--surface` with a hairline edge. Controls are at least 40 px tall on a computer (44 px with a
touch screen). Focus is a 2 px `--accent` outline 2 px out.

One movement, the ink-in, as before, and none with reduced motion.

## Layouts

All widths at 1440 px. The page has a 32 px gutter on each side.

### Site bar (every page but the reader)

```
| Σ Mathesis   Library                     Private texts · Saved · Sync · ◐ |   56 px, --surface, rule below
```

### Library

```
| site bar                                                                      |
| The library   1,822 works by 371 authors, 686 with English                    |   one line, 40 px title
| [ Search an author, a title or a Greek word ...                     / ]       |   24 px field
| With English · Greek only     Order: Authors A–Z · Titles · By kind · Period   |
| Filters: period ▾  dialect ▾  vocabulary ▾                                     |
| Continue reading:  Plato, Apology at 18a  ·  Homer, Iliad at 1.120  ...        |   only when there is one
| Where to begin  (folded, one line)                                            |
|-------------------------------------------------------------------------------|
| A |  Achilles Tatius  Ἀχιλλεὺς Τάτιος  | Leucippe and Clitophon  Τὰ κατὰ...  →  |
| B |  2nd c. AD, novelist              |   novel · 2nd c. · 43,000 words · ■■□ |
| C |  ...                              |                                         |
```

A letter rail runs down the left edge and marks the letter you are under. Each author is one row of a two-column grid:
name, Greek name, dates and description on the left (300 px); the works on the right, each with its Greek title,
kind, length, a three-step vocabulary meter and English or Greek only. An author with more than six works shows six
and "All 37 works". The search marks the letters it matched. The first author is above the fold.

### Reader

```
| ← Library   Ἀπολογία Σωκράτους · Plato, Apology · 17–22  ▾ ━━━━━─────  Notes 3 · Text |  48 px top bar
|                                                                                         |
|     17   ὅτι μὲν ὑμεῖς, ὦ ἄνδρες Ἀθηναῖοι, πεπόνθατε          | οἶδα                      |
|          ὑπὸ τῶν ἐμῶν κατηγόρων, οὐκ [οἶδα]· ἐγὼ δ’ οὖν        | verb · irregular          |
|          καὶ αὐτὸς ὑπ’ αὐτῶν ὀλίγου ἐμαυτοῦ ἐπελαθόμην...      | to know                   |
|          ▸ Show the English                                    | perfect · active · ...    |
|                                                                | ‹ Previous  Next ›  Note  |
|     18   ...                                                   | More about it             |
|                                                                |                           |
|                   ← Sections 1–16     Continue to 23–28 →      |                           |
```

- Rail 56 px and text 680 px, centred. The look-up's panel slides in from the right and the text moves aside (decision 1).
- **Both:** Greek and English side by side, each 30 em, their passages aligned at the top of each row.
- **English:** one column at `--t-body`.
- The look-up's two layers stay. Layer two drops the meaning and grammar it repeated and opens on LSJ.
- The bar's Notes menu starts with "Save this book" and "Save passage 17a" (the passage at the top of the screen). Under them
  it lists the book's notes and saved places, the whole book first, each with Remove, and Undo after a removal. A note opened
  from a mark, from Notes or from a passage's number opens in the look-up's panel to edit.
- A passage's number in the rail is a button: it saves the passage, or opens its note. It looks like the number until the
  pointer is on it, when it is underlined.

### Saved

Two columns. On the left, a sticky list of books with a count each, which filters the right, then Saved books and Saved
words. On the right, each note with the Greek it is on (the word, or the first line of the passage), its text, and Open,
Edit, Remove. A book or passage saved without a note says so in small italic, and offers "Add a note" in place of Edit.

### Sync

Two columns. On the left, what sync is and how it works. On the right, the actions: "I have a code" first for a device
that has one, "Make a new code" under it, or, when synced, the code's state and "Stop syncing here".

### Credits

Section names hang in a 240 px left column; the entries run in two columns beside them.

### Not found

The site bar, "This page is not here", a search field that goes to the library, and a link to the library.

## Checks

`scripts/check-design.mjs` and `check-a11y.mjs` move to these tokens: only these sizes, only these colours, only the
three typefaces, contrast in Paper and Night, names on every control.
