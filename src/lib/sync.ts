"use client";
/**
 * Syncing a device, and reading the private texts (SPEC.md, "Sync and private texts"). There is no account: the device keeps a
 * sync code, its own: a new one starts empty, and only the owner's opens the private texts. The database's functions read nothing
 * for a code they do not know (supabase/migrations/…_sync_codes.sql and …_own_codes_and_notes.sql).
 * A device with no code never contacts Supabase. The private texts are asked for with cache "no-store", so the browser keeps none
 * of their words in its cache, and the page keeps them only in memory.
 */
import { useSyncExternalStore } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SYNC_ON } from "@/config/supabase";
import { checkTranslation, type TranslationDoc } from "@/lib/mine/private-translations";
import { parseSyncCode, type SyncCode } from "@/lib/sync-code";

export const CODE_KEY = "mathesis-reader:sync-code";
const CHANGED = "mathesis-reader:sync-changed";

export function savedCode(): SyncCode | null {
  try { return parseSyncCode(localStorage.getItem(CODE_KEY) ?? ""); } catch { return null; }
}
function keep(code: SyncCode | null) {
  try { if (code) localStorage.setItem(CODE_KEY, code); else localStorage.removeItem(CODE_KEY); } catch { /* storage blocked: synced for this page only */ }
  dispatchEvent(new Event(CHANGED));
}

const subscribe = (on: () => void) => {
  addEventListener("storage", on); addEventListener(CHANGED, on);
  return () => { removeEventListener("storage", on); removeEventListener(CHANGED, on); };
};
/** This device's code: undefined while the page is still being built, null when it has none. */
export function useSyncCode(): SyncCode | null | undefined {
  return useSyncExternalStore(subscribe, savedCode, () => undefined);
}

/** A code the database does not know (removed, or mistyped). */
export class UnknownCode extends Error {}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!SYNC_ON) throw new Error("This copy of the app was built without the Supabase settings (.env.local).");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", cache: "no-store",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (body?.code === "28000") throw new UnknownCode("That sync code is not known. Check it, or make a new one.");
  if (!res.ok) throw new Error(body?.message ?? `The database answered ${res.status}.`);
  return body as T;
}

/** A private text as the library lists it: a few fields read out of the stored document, not its whole text. */
export interface PrivateSummary { id: string; title: string | null; author: string | null; status: string | null }

export const listPrivate = (code: SyncCode) => call<PrivateSummary[]>("private_texts", { code });

/** Keeps the code on this device once the database has accepted it. */
export async function syncDevice(code: SyncCode): Promise<void> {
  await listPrivate(code);
  keep(code);
}
/** A new code from the database, kept on this device at once. It starts empty. */
export async function makeCode(): Promise<SyncCode> {
  const code = parseSyncCode(await call<string>("make_sync_code", {}));
  if (!code) throw new Error("The database gave a code this app cannot read.");
  keep(code);
  return code;
}
export const forgetCode = () => keep(null);

export const notesList = (code: SyncCode) => call<unknown>("notes_list", { code });
export const notesSave = (code: SyncCode, notes: unknown[]) => call<null>("notes_save", { code, notes });

export type PrivateText =
  | { state: "ready"; doc: TranslationDoc }
  | { state: "missing" }
  | { state: "broken"; problems: string[] };

/** One private text, checked as the old app checked it before showing it. */
export async function getPrivate(code: SyncCode, id: string): Promise<PrivateText> {
  const doc = await call<unknown>("private_text", { code, text_id: id });
  if (doc === null) return { state: "missing" };
  const c = checkTranslation(doc);
  return c.ok ? { state: "ready", doc: c.doc } : { state: "broken", problems: c.problems };
}

/** A plain-English message for a failure. */
export function trouble(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "The database could not be reached. Check your connection, then try again.";
  return m;
}
