/**
 * A sync code (supabase/migrations/20261112120000_sync_codes.sql): 20 characters of Crockford's base 32, shown in fives of four.
 * Typed by hand, so the reading forgives what Crockford forgives: any case, spaces and hyphens, I and L for 1, O for 0.
 */
const ALPHABET = /^[0-9A-HJKMNP-TV-Z]{20}$/;

export type SyncCode = string & { readonly __brand: "SyncCode" };

/** The code as the database knows it, or null when the text cannot be one. */
export function parseSyncCode(typed: string): SyncCode | null {
  const c = typed.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return ALPHABET.test(c) ? (c as SyncCode) : null;
}

export const showSyncCode = (c: SyncCode) => c.match(/.{4}/g)!.join("-");
