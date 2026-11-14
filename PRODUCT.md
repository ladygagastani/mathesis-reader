# Product

<!-- impeccable:product-schema 1 -->

Written 2026-11-14 by impeccable `init`, from SPEC.md, README.md and the owner's instructions in the redesign session.
The owner asked not to be stopped for questions after choosing the design, so no interview was held. Lines marked
*(inferred)* are drawn from the repository, not confirmed by the owner; change them freely.

## Platform

web

## Users

People learning Ancient Greek who want to read real texts, in the original, from their first weeks: they know some
grammar and a little vocabulary, and meet unknown words in every line. They read for long stretches, on a computer at
a desk and on a phone. *(inferred: the first-week learner from SPEC.md's line; that more advanced readers use it too is
likely but unconfirmed.)*

The owner is also a user: one sync code, marked as the owner's, opens private translations.

## Product Purpose

"Read real Ancient Greek from the first week, with every word explained on the line." A reader for the Greek
classics: the library of 1,822 works, a text in Greek alone or beside its English, and a look-up that explains any
word where it stands. Success is the moment SPEC.md names: you click a word and see its meaning, its form and its LSJ
entry without leaving the sentence.

## Positioning

The look-up is built from the text's own treebank where one exists (GLAUx), so it can say what the word does in this
sentence, not only what it can mean; where there is none, a form index and the Morpheus parser stand in, and an
uncertain parsing says so. The texts are read at the exact edition the catalogue pins, from GitHub, and nothing is
copied.

## Operating Context

A static site (Next.js export) on GitHub Pages; no server. Texts come from GitHub at pinned versions, word data and LSJ
from mathesisstoicheion.com packs, the catalogue from mathesisstoicheion.com. There is no sign-in: a random sync code
carries notes between devices, and a device without a code never contacts the database.

## Capabilities and Constraints

- The five parts of version 1: the reader, the look-up, the library, sync with private texts, notes and saved words
  (SPEC.md).
- Left out of version 1: forum, map, wiki, the Academy, offline reading, Listen's successors, Compare, Share.
- Polytonic Greek must render fully in every face that sets Greek (DESIGN.md, "Hard limit").
- One runtime library beyond React and Next: `saxes`.
- Done means: build, tests and lint pass; every screen works at 390 px and 1440 px; every control clicked in a real
  browser; keyboard, screen-reader names, contrast and 44 px targets checked.

## Brand Commitments

- The name Mathesis Reader and the line above.
- The look is DESIGN.md (Tondo, chosen by the owner on 2026-11-14). The old app's design is a reference, not a target.
- The owner's standing choices about the look-up: it slides in from the right on a computer and the text moves aside;
  on a phone it is a sheet from the foot of the screen; Wiktionary stays in its second layer.
- Plain English in the interface and the documents, without filler.

## Evidence on Hand

The Greek and English of the catalogue's works, the treebank, LSJ and Wiktionary data the look-up reads, and the test
fixtures in `test-fixtures/` (the Apology among them). There are no testimonials, user numbers or reviews; none may be
invented.

## Product Principles

1. The Greek comes first. Everything else on the page serves reading it.
2. A word's explanation never takes you away from the sentence.
3. Say what is certain and say what is not: an uncertain parsing is marked as uncertain.
4. Nothing about the reader leaves the device unless the reader asks for sync.

## Accessibility & Inclusion

Keyboard use throughout (arrows step from word to word, g opens Go to, ? lists the keys), names on every control,
contrast of 4.5 : 1 for all text in both themes, targets of 44 px on touch screens, and no motion under reduced motion.
