# Mathesis Reader: version 1

"Read real Ancient Greek from the first week, with every word explained on the line."

The moment it must win: you click a word and see its meaning, its form and its LSJ entry in place, without leaving
the sentence.

## The five parts

1. **The reader.** A book opens on its text, the first time under its title page. The Greek stands alone. Each passage
   has "Show the English", which sets the translation under that passage only. The reader has its own bar along the
   top: Library, the book's title, where you are (Go to: a passage by its reference, Find in this book, the pages),
   Notes, Text and the keys. Text holds Paper or Night, the Greek size, the line spacing, Greek, Both or English, and
   the edition and translation where a work has more than one. A book opens again where you stopped. The keys: left
   and right turn the page (or step from word to word with a word looked up), g opens Go to, ? lists the keys, and /
   searches the library from any page.
2. **The look-up.** Clicking or tapping a Greek word, or pressing Enter on it, opens the look-up. At 760 px and
   wider it is a card floating by the word, under it or over it, never on it. Below 760 px it is a
   low sheet over about a quarter of the screen, and the text scrolls so the word stays above it. Layer one shows the
   dictionary form, the kind of word, one meaning line with its source, what the word does in the sentence (only
   where the treebank says) and the grammar in plain words. "More about it" opens layer two: the full LSJ entry and
   every analysis the data gives, Wiktionary's senses and word family, and links to Logeion and Perseus. An uncertain
   parsing says so. Escape or the close button shuts it and puts the focus back on the word.
3. **The library.** A search field first: an author, a title, or a Greek word in a title. Then the books you are
   reading, and, folded, where to begin. Under them the catalogue, always opening as one list of authors A to Z, each
   with their works beside them; it can also list titles A to Z, or group by kind of writing or by period, and filter by
   period, dialect and vocabulary. Each work shows its Greek title, kind, dates, length and how familiar its words are.
   A work opens straight into the reader.
4. **Sync and private texts.** There is no sign-in, for privacy. Under Sync, "Make a new code" gets a code of 20
   random letters and digits from the database. Each code is its own and starts empty. The page offers to save it to
   your files, and its fields let 1Password and other password managers keep it and fill it in. Typing the same code on
   another device brings your notes there. One code, marked once in the SQL editor as the owner's, also opens the
   private texts (table `private_translations`): a "Private texts" button at the top right of every page opens a small
   floating list of them, so the library itself opens on the works. They open in the same reader. A device
   without a code never contacts Supabase. The app asks for no email and no password, and the database keeps only a
   hash of each code.
5. **Notes and Saved.** In the look-up, "Note" writes a note on the word, its line of verse, or its passage, in one of
   four colours; selecting words in the text offers a note on them. A note is kept as you write it. "Save word" keeps
   a word, with its meaning and where it was met. A noted word is underlined in its colour, and a noted line or passage has a bar of it at its left. At
   the right edge of the window, a mark for each note stands where the scrollbar's thumb stands when the note is in
   view, and clicking it jumps there and opens the note. The bar's Notes lists the book's notes. The Saved page
   lists every note, book by book, to open, edit or remove, and the saved words. Notes stay on the device, and go with the sync code when
   there is one.

Not in version 1, with no hooks left for them: forum, map, wiki, lyre, vase studio, census, manuscripts, metre, eras,
the Android app, photographs, Listen, Echoes, Compare, Share.

## The look

In [DESIGN.md](DESIGN.md) (12 Nov 2026), which keeps the old design's spirit (ADRs 0008 and 0009 of the old app) with
its own type scale, colours, spacing and layouts. Paper and Night follow the device unless the site bar or Text sets
one. Black ink, red for the chosen thing, hairline rules, square corners, no shadows. EB Garamond for English, GFS
Didot for the title page, Gentium Book Plus for Greek, and no other typeface. One movement, the ink-in, off with reduced
motion. Everything a finger presses is at least 44 px tall on a touch screen, 40 px with a mouse.

## Where the data comes from

Nothing is copied. The app reads, at the moment you need it:
- the catalogue, `https://mathesisstoicheion.com/data/catalog.json`;
- a text's XML from GitHub, pinned to the exact version the catalogue names, as the old app does;
- the word data, syntax and LSJ for that text only, from `https://mathesisstoicheion.com/packs/`.

## How it is built

The same stack as the old app: Next.js as a static site (pages built ahead of time, no server), React, TypeScript,
Vitest for tests, Playwright for browser checks, ESLint for lint. One runtime library beyond React and Next:
`saxes` (reads the texts' XML). The private texts are read with two plain requests to the database's functions, without supabase-js. Zustand,
three.js, OpenSeadragon and abcjs stay behind.

## Done means

Build, tests and lint pass. Every screen works at 390 px and 1440 px, with screenshots reviewed and visual bugs fixed.
Every control has been clicked in a real browser. Keyboard use, screen-reader names, contrast in Paper and Night and
44 px targets pass the copied checks. Page weight and load time are measured against the old reader.

## Open questions for you

1. **The Academy.** Leave it out of version 1, or bring back a part of it (which)?
2. **The Treasury** (saved words, notes). Answered 2026-11-12: notes and saved words are in; notebooks are not.
3. **Offline reading.** Leave it out, or keep "download this book for reading offline"?
4. **The texts come from GitHub, not from `/packs/`.** The old app works this way. Is reading them from GitHub fine?
5. **Admin of private texts.** Do you add private texts through the old app's admin page, or another way? If the
   new app should have that page, say so.

Until you answer 1 to 3, the build goes on without them. If there is no answer when the reader works, they stay out
of version 1. For 4 I go on reading from GitHub, and for 5 the new app only reads private texts.
