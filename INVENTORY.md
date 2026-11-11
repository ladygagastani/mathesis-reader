# Inventory of the old app

Made on 2026-11-12 from `mathesisstoicheion/mathesisstoicheion.github.io`, branch `main`, commit `5d6820b` (31 Oct
2026, the newest on GitHub). The copy is in `_old-reference/`, and pushing from it is switched off.

The old app has 51 pages and about 59,000 lines of code in `web/src`.

## Features

Keep means version 1. Later means undecided until you answer in step 2. Drop means not in this app.

| Feature (old page or part) | Verdict | Why |
|---|---|---|
| Reader (`/read`) | Keep | The heart of the app. Rebuilt to ADR 0009: Greek alone, "Show the English" per passage, opens on the text. |
| Word look-up, first and second layer (`WordPanel`) | Keep | The moment the app must win. |
| Look-up placement: margin window at 1100 px and wider, low sheet below | Keep | ADR 0009, decision 1. |
| Aa menu: Greek size, Paper or Night, Greek / Both / English | Keep | Reading comfort. Small. |
| Reader's foot bar (Library, where you are, Aa, Study) | Keep, without Study | Study holds the tools below, all cut or later. |
| Library search and catalogue (`/library`, `/search`, `/library/author`) | Keep | Version 1, item 3. |
| Sign-in (`/account`) | Keep, sign-in only | Needed for private texts. Profiles and forum identity go. |
| Private texts (`/library/private`) | Keep | Version 1, item 4. |
| Settings: Follow device, Paper, Night | Keep | Part of the look (ADR 0008, decision 2). |
| Admin of translations (`/admin/translations`) | Later | Only if you upload private texts through the app. I will ask. |
| Academy (`/academy/*`, 15 pages) | Later | You have not decided. I will ask in step 2. |
| Treasury: saved words, notes, notebooks (`/treasury/*`, Mine) | Later | Undecided. I will ask. |
| Offline reading and downloads (`/downloads`, `sw.js`, OPFS copies) | Later | Undecided. I will ask. |
| Work and author pages (`/work/[id]`, `/author/[id]`) | Later | A book should open on its text. A short line in the library may be enough. |
| Home page, About, Guide, Credits | Keep Credits only | Credits are a licence duty. The home page becomes the library. |
| Listen (audio of a passage) | Drop | Not in the four items. |
| Echoes, Compare editions, Find in text, Places, Vocabulary panel, Sentence panel, Share, Talk | Drop | The "60 controls" ADR 0009 complained of. The look-up's second layer keeps the sentence's grammar. |
| Floating reader | Drop | Not needed with one reader. |
| Wiktionary look-up (sends the word to Wiktionary) | Drop | LSJ and the word packs cover it, and no word leaves the site. |
| Forum: Town Hall, Pnyx, members, moderation | Drop | Cut. |
| Map (Periplus) | Drop | Cut. |
| Painted Stoa (wiki), eras, editions, variants, authors | Drop | Cut. |
| Lyre, melodies | Drop | Cut. |
| Vase studio (Kerameikos, pot, amphora) | Drop | Cut. |
| Census | Drop | Cut. |
| Manuscripts (Venetus A viewer) | Drop | Cut. Also removes the one non-commercial licence. |
| Metre bar and scansion | Drop | Cut. |
| Photo plates and frontispieces | Drop | ADR 0009 removed them from the reader, and the library does not need them. |
| Ink-in motion | Keep | One movement only (ADR 0008, decision 3). Off with reduced motion. |
| Android app | Drop | Cut. |
| Phone room bar (Learn, Read, Explore, Mine) | Drop | Four rooms no longer exist. The reader has its own foot bar. |

## What I will lift as is, with its tests

- `web/src/lib/lookup/`: the look-up card, the two layers, placement, part-of-speech tags, word packs, LSJ.
  Not `lesson-link` (Academy) or `wiktionary`, `wiktionary-family`, `occurrences`, `repeats` unless the card needs them.
- `web/src/lib/tei/`: the reader for the texts' XML, references, the Greek and English alignment.
- `web/src/lib/texts/`: fetching a text and its packs. Only the parts for reading online. The OPFS and zip parts are
  for offline reading, so they wait for your answer.
- The helpers these need: `catalog`, `greek`, `syntax`, `constructions`, `lexicon`, `search/codec`, `search/place`,
  `search/input`, `config/packs`. About 1,000 lines.
- The look: `styles/tokens.css` (colours, type scale, spacing), the three typefaces and the site's own sign fonts in
  `web/src/fonts/` (with their OFL licences), the ink-in keyframes, and the look checks: `check-design`, `check-look`,
  `check-lookup`, `check-still`, `sideways`, `check-a11y`, `check-spill`, `check-room`.
- `private-translations.ts` and `-db.ts`, after a read through, for the private texts.

## What surprised me

1. **The texts are not in `/packs/`.** The packs hold word data, syntax, LSJ and the Word Study index. The Greek and
   English texts come from GitHub itself (the Perseus and First1KGreek collections), pinned to an exact version,
   and a 1.3 MB catalogue file in the site lists them. I will read them the same way. Nothing is copied.
2. **The reader is one 1,957-line file** (`Reader.tsx`), with 47 files around it in `components/reader/`.
3. **The look-up is tied to other features.** The card imports the search index's code and a 373-line grammar file,
   and `lesson-link` ties it to the Academy. I will cut the ties when I lift it.
4. **Three heavy libraries serve cut features only:** three.js (the vase studio), OpenSeadragon (manuscripts) and
   abcjs (the lyre). None comes across.
5. **The old checks were not all green.** On 23 Oct, lint had 16 errors, two unit-test files needed this laptop's data,
   and eight browser tests failed. None of these come across.
6. **The library loads the whole 1.3 MB catalogue** before it shows anything. On a phone that is the slowest part of
   the first load. I will look for a smaller way in step 4.
7. **The old CLAUDE.md asks the builder to wait for your go after every step.** Your new brief says carry on, so
   that wins here.
