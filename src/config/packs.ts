/**
 * Where the data is read from. Nothing is copied into this app: the catalogue and the core vocabulary are files of the
 * old site, and the word analyses (words), sentence analyses (syntax) and LSJ (lsj) are its data packs, published at
 * https://mathesisstoicheion.com/packs/ by the old repository's pipeline/publish_packs.py. All are served with
 * "Access-Control-Allow-Origin: *", so a copy of this app running anywhere can read them.
 * Three exceptions, built by this app's scripts and served by this app itself: the form index (public/forms, lib/lookup/forms.ts),
 * built from those word packs by scripts/build-forms.mjs; the meaning list (public/meanings, lib/lookup/meanings.ts), built by
 * scripts/build-meanings.mjs from the word packs, LSJ, the core vocabulary, the Middle Liddell and Wiktionary; and each work's
 * entry in the catalogue (public/catalog, lib/catalog.ts, loadWorkCatalog), cut from the catalogue by scripts/build-catalog.mjs.
 */
export const DATA_SITE = process.env.NEXT_PUBLIC_DATA_SITE || "https://mathesisstoicheion.com";
export const PACKS = `${DATA_SITE}/packs`;
export const CATALOG_URL = `${DATA_SITE}/data/catalog.json`;
export const CORE_URL = `${DATA_SITE}/data/core.json`;
