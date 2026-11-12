/** Small, well-defined helpers for Greek text. */

/** A Greek word: Greek letters and combining marks, with an elision mark allowed at the end. */
export const GREEK_WORD = /([Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ]*(?:[ʼ’'᾽])?)/u;
export const isGreekWord = (s: string) => /^[Ͱ-Ͽἀ-῿]/u.test(s);

const GRAVE_TO_ACUTE: Record<string, string> = {
  "ὰ": "ά", "ὲ": "έ", "ὴ": "ή", "ὶ": "ί", "ὸ": "ό", "ὺ": "ύ", "ὼ": "ώ",
  "ἂ": "ἄ", "ἃ": "ἅ", "ἒ": "ἔ", "ἓ": "ἕ", "ἢ": "ἤ", "ἣ": "ἥ", "ἲ": "ἴ", "ἳ": "ἵ", "ὂ": "ὄ", "ὃ": "ὅ", "ὒ": "ὔ", "ὓ": "ὕ", "ὢ": "ὤ", "ὣ": "ὥ",
  "ᾲ": "ᾴ", "ῂ": "ῄ", "ῲ": "ῴ", "ᾂ": "ᾄ", "ᾃ": "ᾅ", "ᾒ": "ᾔ", "ᾓ": "ᾕ", "ᾢ": "ᾤ", "ᾣ": "ᾥ", "ῒ": "ΐ", "ῢ": "ΰ",
};

/**
 * The form a dictionary would look up: a grave accent (which only appears because another word
 * follows) becomes acute, and a trailing elision mark is dropped.
 */
export function lookupForm(word: string): string {
  let w = word.normalize("NFC").replace(/[ʼ’'᾽]$/, "");
  const last = [...w];
  for (let i = last.length - 1; i >= 0; i--) {
    if (GRAVE_TO_ACUTE[last[i]]) { last[i] = GRAVE_TO_ACUTE[last[i]]; break; }
  }
  w = last.join("");
  return w;
}

const isElided = (word: string) => /[ʼ’'᾽]$/.test(word);

/** Lower-case the first letter, for words capitalised only because they begin a sentence. */
const decapitalise = (w: string) => w.charAt(0).toLocaleLowerCase("el") + w.slice(1);

/**
 * The dictionary forms worth trying for a word as printed, when there is no analysis to give its dictionary form: the word
 * with a grave made acute; an elided word with each vowel it may have lost; and each of these without a sentence's capital.
 */
export function candidates(word: string): string[] {
  const base = lookupForm(word);
  const out: string[] = [];
  const add = (w: string) => { if (w && !out.includes(w)) out.push(w); };
  if (isElided(word)) {
    for (const v of ["α", "ε", "ο", "ι"]) add(base + v);
    for (const v of ["ά", "έ", "ό", "ί"]) add(base + v);
  } else add(base);
  for (const w of [...out]) if (w !== decapitalise(w)) add(decapitalise(w));
  return out;
}

/** Plain-text normalisation for searching: no accents, breathings or case; final sigma folded. */
export function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ̓̔͂ͅ]/g, "").toLowerCase().replace(/[ςϲ]/g, "σ");
}

/** Search key for a Greek word: no accents, breathings, case or elision mark; final sigma folded. */
export const greekKey = (w: string) => fold(w).replace(/[^α-ωϝ]/g, "");

/**
 * A title from the catalogue as the site can draw it in its three typefaces: the numeral sign (ʹ, which Unicode folds to the
 * modifier letter prime) as an apostrophe; editors' brackets (⟨ ⟩ ⎡ ⎤) left out; an inverted breve used as a circumflex made
 * the circumflex; and any mark still not part of a letter after that (a macron over a numeral, an accent on a consonant) left out.
 */
export function drawableGreek(s: string): string {
  return s
    .replace(/[\u02B9\u0374]/g, "\u2019")
    .replace(/[\u27E8\u27E9\u23A1-\u23A6]/g, "")
    .normalize("NFD").replace(/\u0311/g, "\u0342").normalize("NFC")
    .replace(/[\u0300-\u036F]/g, "");
}
