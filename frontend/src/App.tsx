import { useEffect, useMemo, useState } from "react";
import "./styles/index.css";
import RingVisualizer from "./components/RingVisualizer";
import ChurnTable from "./components/ChurnTable";
import KeyAssignments from "./components/KeyAssignments";
import LegendTips from "./components/LegendTips";
import type { Server, Strategy } from "./logic/types";
import { chPickServer, simpleHashPick, hash32 } from "./logic/hashing";
import { uid } from "./logic/utils";

function initServers(n: number): Server[] {
  const base = 8081;
  return Array.from({ length: n }, (_, i) => ({
    id: `localhost:${base + i}`,
    port: base + i,
    healthy: true,
  }));
}

function nextPort(servers: Server[]) {
  const ports = servers.map((s) => s.port);
  let p = 8081;
  while (ports.includes(p)) p++;
  return p;
}

export default function App() {
  const [servers, setServers] = useState<Server[]>(() => initServers(4));
  const [strategy, setStrategy] = useState<Strategy>("CH");
  const [staticIndex, setStaticIndex] = useState(0);
  const [key, setKey] = useState("10.0.0.1");
  const [lastRouted, setLastRouted] = useState<string | null>(null);
  // stateful RR pointer for sequential routing on Fire
  const [rrIndex, setRrIndex] = useState(0);

  // sticky key tracking + assignments
  const [trackedKeys, setTrackedKeys] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});

  // churn snapshots
  const [beforeMap, setBeforeMap] = useState<Record<string, string> | null>(null);
  const [afterMap, setAfterMap] = useState<Record<string, string> | null>(null);

  // stable “pure” router used for assignments & diffs
  function routePure(srvs: Server[], strat: Strategy, k: string) {
    if (srvs.length === 0) return null;
    if (strat === "RR") {
      // deterministic pseudo-RR using key hash to keep diffs stable
      const idx = hash32(k) % srvs.length;
      return srvs[idx];
    } else if (strat === "STATIC") {
      return srvs[Math.min(staticIndex, srvs.length - 1)];
    } else if (strat === "SIMPLE") {
      return simpleHashPick(srvs, k);
    }
    return chPickServer(srvs, k);
  }

  function rebuildAssignments(srvs = servers) {
    const keys = Array.from(new Set(trackedKeys));
    const next: Record<string, string[]> = {};
    for (const k of keys) {
      const s = routePure(srvs, strategy, k);
      if (s) {
        if (!next[s.id]) next[s.id] = [];
        next[s.id].push(k);
      }
    }
    setAssigned(next);
  }

  useEffect(() => {
    rebuildAssignments();
  }, [servers, strategy, staticIndex]);

  useEffect(() => {
    setKey("10.0.0.1");
    setLastRouted(null);
    setTrackedKeys([]);
    setAssigned({});
    setBeforeMap(null);
    setAfterMap(null);
    setRrIndex(0);
  }, [strategy]);

  // keep RR pointer in range when server list changes
  useEffect(() => {
    setRrIndex((i) => (servers.length > 0 ? i % servers.length : 0));
  }, [servers.length]);

  // ——— actions ———
  function fire() {
    const k = key.trim() || uid();
    const s = strategy === "RR"
      ? (servers.length ? servers[rrIndex % servers.length] : null)
      : routePure(servers, strategy, k);
    if (!s) return;
    setLastRouted(s.id);
    if (strategy === "RR" && servers.length) {
      setRrIndex((i) => (i + 1) % Math.max(servers.length, 1));
    }
    setTrackedKeys((prev) => (prev.includes(k) ? prev : [...prev, k]));
    // update assignments for the chosen key quickly
    setAssigned((prev) => {
      const next: Record<string, string[]> = {};
      for (const sid of Object.keys(prev)) next[sid] = prev[sid].filter((x) => x !== k);
      const list = next[s.id] ? [...next[s.id]] : [];
      if (!list.includes(k)) list.push(k);
      next[s.id] = list;
      return next;
    });
  }

  function addServer() {
    setBeforeMap(computeMap(servers));
    const np = nextPort(servers);
    const ns = [...servers, { id: `localhost:${np}`, port: np, healthy: true }];
    setServers(ns);
    setAfterMap(computeMap(ns));
    rebuildAssignments(ns);
  }

  function removeServer() {
    if (servers.length === 0) return;
    setBeforeMap(computeMap(servers));
    const ns = servers.slice(0, -1);
    setServers(ns);
    if (ns.length === 0) {
      // if ring is empty, clear keys so UI doesn’t show stale data
      setTrackedKeys([]);
      setAssigned({});
      setAfterMap({});
      setLastRouted(null);
      return;
    }
    setAfterMap(computeMap(ns));
    rebuildAssignments(ns);
  }

  function clearDiff() {
    setBeforeMap(null);
    setAfterMap(null);
  }

  function computeMap(srvs: Server[]) {
    const m: Record<string, string> = {};
    for (const k of trackedKeys) {
      const s = routePure(srvs, strategy, k);
      m[k] = s ? s.id : "<nil>";
    }
    return m;
  }

  const diff = useMemo(() => {
    if (!beforeMap || !afterMap) return null;
    const keys = Array.from(new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]));
    let moved = 0;
    const rows = keys.map((k) => {
      const b = beforeMap[k];
      const a = afterMap[k];
      const changed = b !== a;
      if (changed) moved++;
      return { k, b, a, changed };
    });
    return { moved, total: keys.length, rows };
  }, [beforeMap, afterMap]);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Load Balancer Visualizer</h1>
          <p>Round Robin • Simple Hash • Consistent Hash • Static</p>
        </div>
      </header>

      <div className="grid-3">
        {/* Initialization */}
        <div className="card">
          <div className="section-title">Initialization</div>
          <div className="row">
            {[3,4,5,6].map(n => (
              <button key={n} className="btn" onClick={() => { setServers(initServers(n)); setTrackedKeys([]); setAssigned({}); clearDiff(); setLastRouted(null); }}>{n}</button>
            ))}
          </div>
          <div className="row mt">
            <button className="btn" onClick={addServer}>Add Server</button>
            <button className="btn ghost" onClick={removeServer} disabled={servers.length===0}>Remove Server</button>
            <button className="btn ghost" onClick={() => { setStrategy("CH"); setKey("10.0.0.1"); setServers(initServers(4)); setStaticIndex(0); setLastRouted(null); clearDiff(); setTrackedKeys([]); setAssigned({}); }}>Reset</button>
          </div>
        </div>

        {/* Traffic & Strategy */}
        <div className="card">
          <div className="section-title">Traffic & Strategy</div>
          <label className="label">Key (IP/User ID)</label>
          <input
            className="input"
            placeholder="10.0.0.1"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className="row mt">
            <select
              className="input"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
            >
              <option value="RR">Round Robin</option>
              <option value="SIMPLE">Simple Hash</option>
              <option value="CH">Consistent Hash</option>
              <option value="STATIC">Static</option>
            </select>
          </div>
          {strategy === "STATIC" && (
            <div className="row mt">
              <label className="label">Static Index</label>
              <select
                className="input"
                value={staticIndex}
                onChange={(e) => setStaticIndex(parseInt(e.target.value))}
              >
                {Array.from({ length: servers.length }, (_, i) => (
                  <option key={i} value={i}>Index {i}</option>
                ))}
              </select>
            </div>
          )}
          <div className="row mt">
            <button className="btn" onClick={fire}>Fire</button>
            <button className="btn ghost" onClick={() => setKey(uid())}>Random Key</button>
          </div>
        </div>

        <LegendTips />
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <RingVisualizer
          servers={servers}
          assignments={assigned}
          lastRoutedId={lastRouted}
          onFire={fire}
          width={820}
          height={520}
          radius={210}
        />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <KeyAssignments servers={servers} assigned={assigned} />
        <ChurnTable diff={diff} />
      </div>
    </div>
  );
}
