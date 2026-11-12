# Mathesis Reader

"Read real Ancient Greek from the first week, with every word explained on the line."

A smaller, new version of Mathesis Stoicheion's reader. What version 1 holds is in [SPEC.md](SPEC.md). What came from the old
app, and why, is in [INVENTORY.md](INVENTORY.md). How the new reader compares with the old one is in
[docs/reader-comparison.md](docs/reader-comparison.md).

## Running it

You need Node.js 24 and a `.env.local` with the Supabase settings. `.env.example` lists them.

```bash
npm install
npm run dev
```

The app opens at http://localhost:3000. It reads its texts and data from the old site and from GitHub, so it needs a connection.

## Checks

| Command | What it checks |
|---|---|
| `npm test` | The logic: the look-up, the texts' parsing and alignment, the library's search and order, the private texts' format |
| `npm run lint` and `npm run typecheck` | The code |
| `npm run build` | The site builds into `out/` |
| `npm run e2e` | Every control of every screen, clicked in a real browser at 1440 px and 390 px, against the built site |
| `node scripts/check-design.mjs` | Only the three typefaces, sizes on the type scale, colours from the tokens, one filled-button colour, in Paper and Night |
| `node scripts/check-a11y.mjs` | Contrast in Paper and Night, names for every control, and finger-sized targets on a phone |
| `node scripts/shots.mjs` | Screenshots of every screen, into `screenshots/new` |
| `node scripts/weigh.mjs` | Page weight and load time on a slow phone, against the old reader |

The browser tests and the look checks never contact the real database. `scripts/fake-supabase.mjs` answers in its place, with
a made-up sync code and placeholder text only.

## Sync codes

The private texts need no sign-in. Run `supabase/migrations/20261112120000_sync_codes.sql` once in the Supabase SQL editor.
Then `select public.new_sync_code('phone');` prints a new code, once. Type it under Sync on each device. Deleting its row
from `public.sync_codes` stops it working everywhere. Each check's first lines say how it was shown to catch the kind of bug it is for.

## Folders

- `src/lib`: the logic, each part with its tests.
- `src/components` and `src/app`: the screens.
- `scripts` and `e2e`: the checks.
- `_old-reference`: a read-only copy of the old app. It is not part of this app, and pushing from it is switched off.
- `_archive`: files moved out of the way. Nothing is deleted.
