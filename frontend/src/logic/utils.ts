import type { Server, Strategy, Mapping } from "./types";
import { chPickServer, hash32, simpleHashPick } from "./hashing";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function initServers(n: number): Server[] {
  const base = 8081;
  return Array.from({ length: n }, (_, i) => ({
    id: `localhost:${base + i}`,
    port: base + i,
    healthy: true,
  }));
}

export function nextPort(servers: Server[]): number {
  const ports = servers.map((s) => s.port);
  let p = 8081;
  while (ports.includes(p)) p++;
  return p;
}

/**
 * Visual placement around a ring.
 * Stable order: sort by base hash `${id}#0` so adding/removing nodes
 * doesn't make others jump visually.
 */
export function placeOnCircle(
  servers: Server[],
  center: { x: number; y: number },
  r: number
) {
  const base = servers
    .map((s) => ({ key: hash32(`${s.id}#0`), server: s }))
    .sort((a, b) => a.key - b.key);

  return base.map((p, i) => {
    const angle = (2 * Math.PI * i) / Math.max(base.length, 1) - Math.PI / 2;
    return {
      server: p.server,
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
      angle,
    };
  });
}

/** Pure routing used for assignments & diffs (no RR state). */
export function routeKeyPure(
  servers: Server[],
  strategy: Strategy,
  key: string,
  staticIndex: number
): Server | null {
  if (!servers || servers.length === 0) return null;

  switch (strategy) {
    case "RR": {
      // deterministic pseudo-RR using key hash
      const idx = hash32(key) % servers.length;
      return servers[idx];
    }
    case "STATIC": {
      return servers[Math.min(staticIndex, servers.length - 1)];
    }
    case "SIMPLE": {
      return simpleHashPick(servers, key);
    }
    case "CH":
    default:
      return chPickServer(servers, key);
  }
}

/** Compute key -> server mapping for a key set under a topology+strategy. */
export function computeMapping(
  servers: Server[],
  strategy: Strategy,
  keys: string[],
  staticIndex: number
): Mapping {
  const m: Mapping = {};
  for (const k of keys) {
    const s = routeKeyPure(servers, strategy, k, staticIndex);
    m[k] = s ? s.id : "<nil>";
  }
  return m;
}
