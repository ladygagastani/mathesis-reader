/**
 * Local copies of the original collections, in two places:
 *  - browser storage (the Origin Private File System), laid out as <repo>/data/…
 *  - folders on this computer that the reader connected (File System Access API, Chromium browsers).
 * Folder handles are remembered in IndexedDB; after a browser restart they need one click to
 * be allowed again ("Reconnect folders").
 */
import type { CatText, CatalogIndex, CollectionId } from "@/lib/catalog";
import { kvGet, kvSet } from "./kv";

// ------------------------------------------------------------------ browser storage (OPFS)
export const hasBrowserStorage = () => typeof navigator !== "undefined" && !!navigator.storage?.getDirectory;

async function opfsDir(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
  let dir = await navigator.storage.getDirectory();
  for (const p of parts) {
    try { dir = await dir.getDirectoryHandle(p, { create }); } catch { return null; }
  }
  return dir;
}

export const repoOf = (idx: CatalogIndex, col: CollectionId) => idx.catalog.collections[col].repo;
const splitPath = (p: string) => p.split("/").filter(Boolean);

/**
 * A text file is whole when it ends with its closing </TEI> tag: a copy cut short by an interrupted save is passed over
 * (and the text fetched again) rather than shown broken. Its size is not compared with the catalogue's, since a copy
 * imported from a newer ZIP of the collection may differ a little and is still good to read.
 */
const whole = (xml: string) => /<\/(?:tei:)?TEI>\s*$/.test(xml.slice(-400));

/** A stored file's text; with `xml`, only a whole TEI file. */
export async function opfsRead(repo: string, path: string, xml = false): Promise<string | null> {
  if (!hasBrowserStorage()) return null;
  const parts = splitPath(path);
  const dir = await opfsDir([repo, ...parts.slice(0, -1)], false);
  if (!dir) return null;
  try {
    const f = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    const text = await f.text();
    return !xml || whole(text) ? text : null;
  } catch { return null; }
}

export async function opfsWrite(repo: string, path: string, data: BufferSource | Blob | string) {
  const parts = splitPath(path);
  const dir = await opfsDir([repo, ...parts.slice(0, -1)], true);
  if (!dir) throw new Error("Browser storage is not available.");
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

export async function opfsRemoveRepo(repo: string) {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(repo, { recursive: true }).catch(() => undefined);
}

/** Ask the browser not to clear stored texts when space runs low. */
export const askPersistence = () => navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false);
export const storageEstimate = () => navigator.storage?.estimate?.().catch(() => null) ?? Promise.resolve(null);

// ------------------------------------------------------------------ connected folders
export const canUseFolders = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

/** A place inside a connected folder where a collection's files live. */
interface Root {
  handle: FileSystemDirectoryHandle;
  kind: "repo" | "data";            // "repo": has a data/ folder inside; "data": is the data folder
  col: CollectionId | null;         // null when we can't tell which collection it is
}
export interface Folder { id: string; name: string; handle: FileSystemDirectoryHandle; roots: Root[]; access: PermissionState }

const KEY = "folders";

function guessCollection(name: string): CollectionId | null {
  const n = name.toLowerCase();
  if (n.includes("first1k")) return "first1k";
  if (n.includes("greeklit")) return "perseus";
  return null;
}

async function childDir(d: FileSystemDirectoryHandle, name: string) {
  try { return await d.getDirectoryHandle(name); } catch { return null; }
}

/** Work out where the collections sit inside a folder the reader picked. */
async function findRoots(handle: FileSystemDirectoryHandle): Promise<Root[]> {
  if (await childDir(handle, "data")) return [{ handle, kind: "repo", col: guessCollection(handle.name) }];
  const roots: Root[] = [];
  let looksLikeData = false;
  for await (const [name, h] of handle.entries()) {
    if (h.kind !== "directory") continue;
    if (/^(tlg|ggm|stoa|pmpt|phi)\d/i.test(name)) looksLikeData = true;
    const sub = h as FileSystemDirectoryHandle;
    if (await childDir(sub, "data")) roots.push({ handle: sub, kind: "repo", col: guessCollection(name) });
  }
  if (!roots.length && looksLikeData) roots.push({ handle, kind: "data", col: null });
  return roots;
}

export async function listFolders(): Promise<Folder[]> {
  const saved = (await kvGet<{ id: string; name: string; handle: FileSystemDirectoryHandle; roots: Root[] }[]>(KEY)) ?? [];
  return Promise.all(saved.map(async (f) => ({
    ...f,
    access: (await f.handle.queryPermission?.({ mode: "read" }).catch(() => "prompt" as PermissionState)) ?? "granted",
  })));
}

/** Ask for a folder and remember it. Returns null if the reader cancelled. */
export async function connectFolder(): Promise<{ folder: Folder; found: number } | null> {
  if (!canUseFolders()) throw new Error("This browser cannot open folders. Use Chrome or Edge, or load a ZIP file instead.");
  let handle: FileSystemDirectoryHandle;
  try { handle = await window.showDirectoryPicker!({ id: "mathesis-library", mode: "read" }); }
  catch { return null; }
  const roots = await findRoots(handle);
  const saved = (await kvGet<Omit<Folder, "access">[]>(KEY)) ?? [];
  const folder = { id: `${Date.now()}`, name: handle.name, handle, roots };
  await kvSet(KEY, [...saved.filter((f) => f.name !== handle.name), folder]);
  return { folder: { ...folder, access: "granted" }, found: roots.length };
}

export async function forgetFolder(id: string) {
  const saved = (await kvGet<Omit<Folder, "access">[]>(KEY)) ?? [];
  await kvSet(KEY, saved.filter((f) => f.id !== id));
}

/** One click after a restart: ask again for every remembered folder. Must run from a click. */
export async function reconnectFolders(): Promise<{ granted: number; total: number }> {
  const folders = await listFolders();
  let granted = 0;
  for (const f of folders) {
    const state = f.access === "granted" ? "granted" : await f.handle.requestPermission?.({ mode: "read" }).catch(() => "denied" as PermissionState);
    if (state === "granted") granted++;
  }
  return { granted, total: folders.length };
}

/** Save a file into a folder the reader chose for downloads (read-write). */
export async function folderWrite(root: FileSystemDirectoryHandle, repo: string, path: string, data: BufferSource | Blob) {
  let dir = await root.getDirectoryHandle(repo, { create: true });
  const parts = splitPath(path);
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
  const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

async function readFrom(dir: FileSystemDirectoryHandle, parts: string[]): Promise<string | null> {
  let d = dir;
  for (const p of parts.slice(0, -1)) { const n = await childDir(d, p); if (!n) return null; d = n; }
  try {
    const f = await (await d.getFileHandle(parts[parts.length - 1])).getFile();
    const text = await f.text();
    return whole(text) ? text : null;
  } catch { return null; }
}

// ------------------------------------------------------------------ look-up order
export type Origin = "browser" | "folder";

/** Find a text in local copies: browser storage first, then connected folders. */
export async function readLocal(idx: CatalogIndex, t: CatText): Promise<{ xml: string; from: Origin } | null> {
  const repo = repoOf(idx, t.col);
  const fromBrowser = await opfsRead(repo, t.path, true).catch(() => null);
  if (fromBrowser != null) return { xml: fromBrowser, from: "browser" };
  if (!canUseFolders()) return null;
  for (const f of await listFolders()) {
    if (f.access !== "granted") continue;
    for (const r of f.roots) {
      if (r.col && r.col !== t.col) continue;
      const parts = splitPath(t.path);
      const xml = await readFrom(r.handle, r.kind === "repo" ? parts : parts.slice(1));
      if (xml != null) return { xml, from: "folder" };
    }
  }
  return null;
}
