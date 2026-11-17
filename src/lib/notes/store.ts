"use client";
/**
 * The notes and the saved words on this device, and their sync. The device always keeps its own copy (localStorage), so they work
 * without a code and without a connection. With a sync code the copy is made one with the database's: on the first use in a visit,
 * and a moment after every change. A removed note stays as a mark without its words, and a removed word as a mark, so the removal
 * reaches the other devices too. The database keeps both in one list; each side reads only its own (words.ts).
 */
import { useEffect, useSyncExternalStore } from "react";
import { savedCode, notesList, notesSave, trouble } from "@/lib/sync";
import { mergeNotes, newerThan, parseNotes, type Note } from "./notes";
import { parseWords, type SavedWord } from "./words";

const KEY = "mathesis-reader:notes";
const CHANGED = "mathesis-reader:notes-changed";
const BATCH = 500;
const EMPTY: Note[] = [];
const WORDS_KEY = "mathesis-reader:words";
const NO_WORDS: SavedWord[] = [];

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

let words: SavedWord[] | null = null;
function readWords(): SavedWord[] {
  if (words) return words;
  try { words = parseWords(JSON.parse(localStorage.getItem(WORDS_KEY) ?? "[]")); } catch { words = []; }
  return words;
}
function writeWords(list: SavedWord[]) {
  words = list;
  try { localStorage.setItem(WORDS_KEY, JSON.stringify(list)); } catch { /* storage full or blocked: kept for this visit */ }
  dispatchEvent(new Event(CHANGED));
}

const subscribe = (on: () => void) => {
  const other = (e: StorageEvent) => { if (e.key === KEY) { cache = null; on(); } if (e.key === WORDS_KEY) { words = null; on(); } };
  addEventListener(CHANGED, on); addEventListener("storage", other);
  return () => { removeEventListener(CHANGED, on); removeEventListener("storage", other); };
};

/** Every note on this device, removed ones included (use `shown`). Starts a sync once per visit. */
export function useNotes(): Note[] {
  useEffect(() => { if (!pulled) void syncNotes(); }, []);
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Every saved word on this device, removed ones included (filter on `deleted`). Starts a sync once per visit. */
export function useWords(): SavedWord[] {
  useEffect(() => { if (!pulled) void syncNotes(); }, []);
  return useSyncExternalStore(subscribe, readWords, () => NO_WORDS);
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
        const raw = await notesList(code);
        const theirs = parseNotes(raw), theirWords = parseWords(raw);
        const merged = mergeNotes(read(), theirs), mergedWords = mergeNotes(readWords(), theirWords);
        if (newerThan(merged, read()).length) write(merged);
        if (newerThan(mergedWords, readWords()).length) writeWords(mergedWords);
        const send: (Note | SavedWord)[] = [...newerThan(merged, theirs), ...newerThan(mergedWords, theirWords)];
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

export function saveWord(w: Omit<SavedWord, "updated">) {
  const word: SavedWord = { ...w, updated: Math.max(Date.now(), (readWords().find((x) => x.id === w.id)?.updated ?? 0) + 1) };
  writeWords([...readWords().filter((x) => x.id !== w.id), word]);
  soon();
}

export function removeWord(id: string) {
  const was = readWords().find((x) => x.id === id);
  if (was) saveWord({ ...was, deleted: true });
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
  writeWords([]);
}

/** Puts back a note just removed, as it was before (the menu's Undo). */
export function restoreNote(n: Note) {
  const { updated: _u, deleted: _d, ...rest } = n;
  void _u; void _d;
  saveNote(rest);
}
