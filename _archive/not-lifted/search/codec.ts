/**
 * The search index format, shared by the builder (scripts/build-search.ts) and the site.
 *
 * Each shard file: [uint32 little-endian header length][header JSON][postings bytes].
 * header = { k: keys[], o: byte offsets into postings, n: posting counts }
 * Postings for a key are varint-encoded, sorted by (text, unit, word):
 *   Δtext, (unit if Δtext > 0 else Δunit), word [, extra…]
 */
import { fold } from "@/lib/catalog";
import { GREEK_WORD, isGreekWord } from "@/lib/greek";
import type { Unit } from "@/lib/tei/types";

export interface Posting { text: number; unit: number; word: number; extra: number[] }
export interface ShardHeader { k: string[]; o: number[]; n: number[] }

/** Search key for a Greek word: no accents, breathings, case or elision mark; final sigma folded. */
export const greekKey = (w: string) => fold(w).replace(/[^α-ωϝ]/g, "");
export const englishKey = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");
export const shardOf = (key: string) => (key.slice(0, 2) || "_");

/** Greek words of a passage, in the order the reader shows them as clickable words. */
export function unitWords(u: Unit): string[] {
  const out: string[] = [];
  for (const b of u.blocks) for (const x of b.c) {
    if (typeof x !== "string") continue;
    for (const part of x.split(GREEK_WORD)) if (part && isGreekWord(part)) out.push(part);
  }
  return out;
}

/** English words of a passage. */
export function englishWords(u: Unit): string[] {
  const out: string[] = [];
  for (const b of u.blocks) for (const x of b.c) if (typeof x === "string") out.push(...(x.match(/[A-Za-z]+(?:[’'][a-z]+)?/g) ?? []));
  return out;
}

// ------------------------------------------------------------ varints
export function writeVarint(out: number[], v: number) {
  while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
  out.push(v);
}

export function encodePostings(ps: Posting[], extras = 0): number[] {
  const out: number[] = [];
  let pt = 0, pu = 0;
  for (const p of ps) {
    const dt = p.text - pt;
    writeVarint(out, dt);
    writeVarint(out, dt > 0 ? p.unit : p.unit - pu);
    writeVarint(out, p.word);
    for (let i = 0; i < extras; i++) writeVarint(out, p.extra[i] ?? 0);
    pt = p.text; pu = p.unit;
  }
  return out;
}

export function decodePostings(bytes: Uint8Array, offset: number, count: number, extras = 0): Posting[] {
  const out: Posting[] = [];
  let i = offset, pt = 0, pu = 0;
  const read = () => { let v = 0, m = 1, b: number; do { b = bytes[i++]; v += (b & 0x7f) * m; m *= 128; } while (b & 0x80); return v; };
  for (let k = 0; k < count; k++) {
    const dt = read();
    const text = pt + dt;
    const unit = dt > 0 ? read() : pu + read();
    const word = read();
    const extra: number[] = [];
    for (let e = 0; e < extras; e++) extra.push(read());
    out.push({ text, unit, word, extra });
    pt = text; pu = unit;
  }
  return out;
}

export function packShard(header: ShardHeader, postings: number[]): Uint8Array {
  const h = new TextEncoder().encode(JSON.stringify(header));
  const buf = new Uint8Array(4 + h.length + postings.length);
  new DataView(buf.buffer).setUint32(0, h.length, true);
  buf.set(h, 4);
  buf.set(postings, 4 + h.length);
  return buf;
}

export function unpackShard(buf: Uint8Array): { header: ShardHeader; body: Uint8Array } {
  const len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len))) as ShardHeader;
  return { header, body: buf.subarray(4 + len) };
}
