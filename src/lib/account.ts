"use client";
/**
 * Signing in, and reading the private texts. supabase-js is loaded only when it is needed: on the sign-in page, or when this
 * browser already holds a session. A reader who never signs in never downloads it, and Supabase is never contacted for them.
 * The private texts are asked for with cache "no-store", so the browser keeps none of their words in its cache, and the page
 * keeps them only in memory (as the old app's lib/private-translations-db.ts did).
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNTS_ON, SESSION_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/config/supabase";
import { checkTranslation, type TranslationDoc } from "@/lib/mine/private-translations";

const TABLE = "private_translations";
const PRIVATE = `/rest/v1/${TABLE}`;

export function hasSavedSession(): boolean {
  try { return !!localStorage.getItem(SESSION_KEY); } catch { return false; }
}

let client: Promise<SupabaseClient> | null = null;
function supabase(): Promise<SupabaseClient> {
  if (!ACCOUNTS_ON) return Promise.reject(new Error("This copy of the app was built without the Supabase settings (.env.local)."));
  client ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: SESSION_KEY },
    global: {
      fetch: (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        return fetch(input, url.includes(PRIVATE) ? { ...init, cache: "no-store" } : init);
      },
    },
  }));
  return client;
}

/** Who is signed in on this browser: `ready` once known; `email` null when no one is. */
export function useAccount(): { ready: boolean; email: string | null } {
  const [state, setState] = useState<{ ready: boolean; email: string | null }>({ ready: false, email: null });
  useEffect(() => {
    if (!hasSavedSession()) { queueMicrotask(() => setState({ ready: true, email: null })); return; }
    let live = true, stop = () => {};
    supabase().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      if (live) setState({ ready: true, email: data.session?.user.email ?? null });
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (live) setState({ ready: true, email: session?.user.email ?? null }); });
      stop = () => sub.subscription.unsubscribe();
    }, () => { if (live) setState({ ready: true, email: null }); });
    return () => { live = false; stop(); };
  }, []);
  return state;
}

/** A plain-English message for a failure. */
export function trouble(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "The database could not be reached. Check your connection, then try again.";
  if (/Invalid login credentials/i.test(m)) return "That email and password do not match an account.";
  if (/Email not confirmed/i.test(m)) return "This account's email address has not been confirmed yet.";
  return m;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await (await supabase()).auth.signOut();
  if (error) throw error;
}

/** A private text as the library lists it: a few fields read out of the stored document, not its whole text. */
export interface PrivateSummary { id: string; title: string | null; author: string | null; status: string | null }

/** The private texts this account may read (the database gives none to anyone but their owner). */
export async function listPrivate(): Promise<PrivateSummary[]> {
  const { data, error } = await (await supabase()).from(TABLE)
    .select("id, title:doc->>title, author:doc->>author, status:doc->>status")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PrivateSummary[];
}

export type PrivateText =
  | { state: "ready"; doc: TranslationDoc }
  | { state: "missing" }
  | { state: "broken"; problems: string[] };

/** One private text, checked as the old app checked it before showing it. */
export async function getPrivate(id: string): Promise<PrivateText> {
  const { data, error } = await (await supabase()).from(TABLE).select("doc").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { state: "missing" };
  const c = checkTranslation(data.doc);
  return c.ok ? { state: "ready", doc: c.doc } : { state: "broken", problems: c.problems };
}
