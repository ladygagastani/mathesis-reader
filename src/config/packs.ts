/**
 * Where the data is read from. Nothing is copied into this app: the catalogue and the core vocabulary are files of the
 * old site, and the word analyses (words), sentence analyses (syntax) and LSJ (lsj) are its data packs, published at
 * https://mathesisstoicheion.com/packs/ by the old repository's pipeline/publish_packs.py. All are served with
 * "Access-Control-Allow-Origin: *", so a copy of this app running anywhere can read them.
 */
export const DATA_SITE = process.env.NEXT_PUBLIC_DATA_SITE || "https://mathesisstoicheion.com";
export const PACKS = `${DATA_SITE}/packs`;
export const CATALOG_URL = `${DATA_SITE}/data/catalog.json`;
export const CORE_URL = `${DATA_SITE}/data/core.json`;
