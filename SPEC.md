# Mathesis Reader: version 1

"Read real Ancient Greek from the first week, with every word explained on the line."

The moment it must win: you click a word and see its meaning, its form and its LSJ entry in place, without leaving
the sentence.

## The four parts

1. **The reader.** A book opens on its text under a one-line title. The Greek stands alone. Each passage has "Show the
   English", which sets the translation under that passage only. Aa holds the Greek size, Paper or Night, and Greek,
   Both or English for the whole book. The reader has its own bar at the foot: Library, where you are, and Aa.
2. **The look-up.** Clicking or tapping a Greek word, or pressing Enter on it, opens the look-up. At 1100 px and
   wider it is a window about 300 px wide over the right margin, fixed while the text scrolls. Below 1100 px it is a
   low sheet over about a quarter of the screen, and the text scrolls so the word stays above it. Layer one shows the
   dictionary form, the kind of word, one meaning line with its source, what the word does in the sentence (only
   where the treebank says) and the grammar in plain words. "More about it" opens layer two: the full LSJ entry and
   every analysis the data gives. An uncertain parsing says so. Escape or the close button shuts it and puts the
   focus back on the word.
3. **The library.** A search field first: an author, a title, or a Greek word in a title. Under it the catalogue,
   always opening as one list of authors A to Z, each with their works; "By kind" groups them by kind of writing. A work
   opens straight into the reader.
4. **Sign-in and private texts.** You sign in with the existing Supabase project. Once signed in, your private texts
   (table `private_translations`) appear at the top of the library and open in the same reader. Nobody else sees
   them, and the app never reads or types your password.

Not in version 1, with no hooks left for them: forum, map, wiki, lyre, vase studio, census, manuscripts, metre, eras,
the Android app, photographs, Listen, Echoes, Compare, Find, Share, the Wiktionary look-up.

## The look

The old design, unchanged in spirit: `DESIGN.md` and ADRs 0008 and 0009 of the old app. Paper and Night follow the
device unless Aa sets one. Black ink, red for headings and the chosen thing, hairline rules, square corners, no
shadows. EB Garamond for English, GFS Didot for titles, Gentium Book Plus for Greek, and no other typeface. The old
colour tokens, type scale and spacing scale are copied as they are. One movement, the ink-in, off with reduced
motion. Everything a finger presses is at least 44 px tall.

## Where the data comes from

Nothing is copied. The app reads, at the moment you need it:
- the catalogue, `https://mathesisstoicheion.com/data/catalog.json`;
- a text's XML from GitHub, pinned to the exact version the catalogue names, as the old app does;
- the word data, syntax and LSJ for that text only, from `https://mathesisstoicheion.com/packs/`.

## How it is built

The same stack as the old app: Next.js as a static site (pages built ahead of time, no server), React, TypeScript,
Vitest for tests, Playwright for browser checks, ESLint for lint. Two runtime libraries beyond React and Next:
`saxes` (reads the texts' XML) and `@supabase/supabase-js` (sign-in, loaded only when you sign in). Zustand,
three.js, OpenSeadragon and abcjs stay behind.

## Done means

Build, tests and lint pass. Every screen works at 390 px and 1440 px, with screenshots reviewed and visual bugs fixed.
Every control has been clicked in a real browser. Keyboard use, screen-reader names, contrast in Paper and Night and
44 px targets pass the copied checks. Page weight and load time are measured against the old reader.

## Open questions for you

1. **The Academy.** Leave it out of version 1, or bring back a part of it (which)?
2. **The Treasury** (saved words, notes). Leave it out, or keep saved words only?
3. **Offline reading.** Leave it out, or keep "download this book for reading offline"?
4. **The texts come from GitHub, not from `/packs/`.** The old app works this way. Is reading them from GitHub fine?
5. **Admin of private texts.** Do you add private texts through the old app's admin page, or another way? If the
   new app should have that page, say so.

Until you answer 1 to 3, the build goes on without them. If there is no answer when the reader works, they stay out
of version 1. For 4 I go on reading from GitHub, and for 5 the new app only reads private texts.
