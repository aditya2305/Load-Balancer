import type { Server } from "./types";

// ---------- hashing primitives ----------
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
export function hash32(str: string): number {
  return fnv1a(str) >>> 0;
}

// ---------- Simple Hash ----------
export function simpleHashPick(servers: Server[], key: string): Server | null {
  if (servers.length === 0) return null;
  const idx = hash32(key) % servers.length;
  return servers[idx];
}

// ---------- Consistent Hash (with replicas) ----------
const REPLICAS = 64;

interface RingPair {
  key: number;   // position
  server: Server;
}

function ringPositions(servers: Server[]): RingPair[] {
  const pairs: RingPair[] = [];
  for (const s of servers) {
    for (let r = 0; r < REPLICAS; r++) {
      pairs.push({ key: hash32(`${s.id}#${r}`), server: s });
    }
  }
  pairs.sort((a, b) => a.key - b.key);
  return pairs;
}

export function chPickServer(servers: Server[], keyStr: string): Server | null {
  if (servers.length === 0) return null;
  const pairs = ringPositions(servers);
  const slot = hash32(keyStr);

  // first position >= slot
  let lo = 0, hi = pairs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pairs[mid].key >= slot) hi = mid; else lo = mid + 1;
  }
  const i = lo % pairs.length;
  return pairs[i].server;
}
