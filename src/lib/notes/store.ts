"use client";
/**
 * The notes on this device, and their sync. The device always keeps its own copy (localStorage), so notes work without a code
 * and without a connection. With a sync code the copy is made one with the database's: on the first use in a visit, and a moment
 * after every change. A removed note stays as a mark without its words, so the removal reaches the other devices too.
 */
import { useEffect, useSyncExternalStore } from "react";
import { savedCode, notesList, notesSave, trouble } from "@/lib/sync";
import { mergeNotes, newerThan, parseNotes, type Note } from "./notes";

const KEY = "mathesis-reader:notes";
const CHANGED = "mathesis-reader:notes-changed";
const BATCH = 500;
const EMPTY: Note[] = [];

let cache: Note[] | null = null;
function read(): Note[] {
  if (cache) return cache;
  try { cache = parseNotes(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { cache = []; }
  return cache;
}
function write(notes: Note[]) {
  cache = notes;
  try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* storage full or blocked: kept for this visit */ }
  dispatchEvent(new Event(CHANGED));
}

const subscribe = (on: () => void) => {
  const other = (e: StorageEvent) => { if (e.key === KEY) { cache = null; on(); } };
  addEventListener(CHANGED, on); addEventListener("storage", other);
  return () => { removeEventListener(CHANGED, on); removeEventListener("storage", other); };
};

/** Every note on this device, removed ones included (use `shown`). Starts a sync once per visit. */
export function useNotes(): Note[] {
  useEffect(() => { if (!pulled) void syncNotes(); }, []);
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export type SyncState = { state: "off" | "syncing" | "done" } | { state: "failed"; error: string };
let status: SyncState = { state: "off" };
const setStatus = (s: SyncState) => { status = s; dispatchEvent(new Event(CHANGED)); };
export const useNotesSync = () => useSyncExternalStore(subscribe, () => status, () => status);

let pulled = false;
let running: Promise<void> | null = null;
let again = false;
/** Makes this device's notes and the database's one. Safe to call at any time: calls made while one runs are folded into one more. */
export function syncNotes(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      const code = savedCode();
      if (!code) { setStatus({ state: "off" }); return; }
      setStatus({ state: "syncing" });
      try {
        const theirs = parseNotes(await notesList(code));
        const merged = mergeNotes(read(), theirs);
        if (newerThan(merged, read()).length) write(merged);
        const send = newerThan(merged, theirs);
        for (let i = 0; i < send.length; i += BATCH) await notesSave(code, send.slice(i, i + BATCH));
        pulled = true;
        setStatus({ state: "done" });
      } catch (e) { setStatus({ state: "failed", error: trouble(e) }); }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
function soon() { clearTimeout(timer); timer = setTimeout(() => void syncNotes(), 800); }

export function saveNote(n: Omit<Note, "updated">) {
  const note: Note = { ...n, updated: Math.max(Date.now(), (read().find((x) => x.id === n.id)?.updated ?? 0) + 1) };
  write([...read().filter((x) => x.id !== n.id), note]);
  soon();
}

export function removeNote(id: string) {
  const was = read().find((x) => x.id === id);
  if (was) saveNote({ ...was, text: "", deleted: true });
}

/** Before the code leaves this device: send what is not yet sent, then take the notes off the device (they stay with the code). */
export async function forgetNotes(): Promise<void> {
  clearTimeout(timer);
  await syncNotes();
  if (status.state === "failed") throw new Error(`Your latest notes have not reached the database yet. ${status.error}`);
  pulled = false;
  write([]);
}
