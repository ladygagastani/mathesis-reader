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

/** Plain-text normalisation for searching: no accents, breathings or case; final sigma folded. */
export function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ̓̔͂ͅ]/g, "").toLowerCase().replace(/[ςϲ]/g, "σ");
}

/** Search key for a Greek word: no accents, breathings, case or elision mark; final sigma folded. */
export const greekKey = (w: string) => fold(w).replace(/[^α-ωϝ]/g, "");
