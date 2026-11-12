/**
 * Dates in the site's one convention, BC and AD (the old app's lib/bc-ad.ts, review fix list, slice 6). Wikidata's descriptions and the museums' captions
 * come in their own words, some with BCE and CE; the data files keep those words as they were fetched, and the site shows
 * them in its own.
 */

/** "c. 20 BCE-c. 50 CE" → "c. 20 BC – c. AD 50"; "2nd century CE" → "2nd century AD"; "ca. 14–68 CE" → "ca. AD 14–68" */
export function bcAd(s: string): string {
  return s
    .replace(/\bBCE\b/g, "BC")
    // a year or a span of years before CE: AD goes in front of it
    .replace(/(\d+(?:\/\d+)?(?:\s?[–-]\s?\d+(?:\/\d+)?)?)\s?CE\b/g, (_, y: string) => `AD ${y}`)
    // a century, or "BC and CE"
    .replace(/(centur(?:y|ies)|millennium|BC and)\s?CE\b/g, "$1 AD")
    // a span from BC into AD reads with spaces round its dash: "27 BC – AD 68"
    .replace(/BC\s?[–-]\s?(c\.\s?|ca\.\s?)?AD/g, (_, c = "") => `BC – ${c}AD`);
}
