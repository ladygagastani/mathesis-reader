/**
 * The Supabase project behind sign-in and the private texts: the old app's own (its config/supabase.ts). Both values come from the
 * build settings (.env.local on this computer; see .env.example). The publishable key only lets a browser do what the database's
 * row-level security allows: only the owner can read the table private_translations. The secret key is never used here.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const ACCOUNTS_ON = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
/** Where supabase-js keeps the session in this browser (its own default name) */
export const SESSION_KEY = ACCOUNTS_ON ? `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token` : "sb-none-auth-token";
