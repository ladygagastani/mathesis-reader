/**
 * The Supabase project behind the private texts: the old app's own (its config/supabase.ts). Both values come from the build
 * settings (.env.local on this computer; see .env.example). The publishable key lets a browser call only what the database grants
 * it: the two sync-code functions of supabase/migrations/20261112120000_sync_codes.sql. The secret key is never used here.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const SYNC_ON = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
