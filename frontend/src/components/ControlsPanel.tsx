import type { Strategy } from "../logic/types";

type Props = {
  strategy: Strategy;
  setStrategy: (s: Strategy) => void;

  keyValue: string;
  setKeyValue: (v: string) => void;

  staticIndex: number;
  setStaticIndex: (n: number) => void;

  serversCount: number;

  onInit: (n: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onClearDiff: () => void;
  onReset: () => void;
  onFire: () => void;
  onRandomKey: () => void;
};

export default function ControlsPanel({
  strategy,
  setStrategy,
  keyValue,
  setKeyValue,
  staticIndex,
  setStaticIndex,
  serversCount,
  onInit,
  onAdd,
  onRemove,
  onClearDiff,
  onReset,
  onFire,
  onRandomKey
}: Props) {
  return (
    <div className="grid grid-3 gap">
      <div className="card">
        <div className="card-title">Initialization</div>
        <div className="row">
          {[3,4,5,6].map(n => (
            <button key={n} className="btn" onClick={() => onInit(n)}>{n}</button>
          ))}
        </div>
        <div className="row mt">
          <button className="btn" onClick={onAdd}>Add Server</button>
          <button className="btn ghost" onClick={onRemove} disabled={serversCount===0}>Remove Server</button>
          <button className="btn ghost" onClick={onClearDiff}>Clear Diff</button>
          <button className="btn ghost" onClick={onReset}>Reset</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Traffic & Strategy</div>
        <label className="label">Key (IP/User ID)</label>
        <input
          className="input"
          placeholder="10.0.0.1"
          value={keyValue}
          onChange={(e) => setKeyValue(e.target.value)}
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

          {strategy === "STATIC" && (
            <select
              className="input"
              value={staticIndex}
              onChange={(e) => setStaticIndex(parseInt(e.target.value))}
            >
              {Array.from({ length: serversCount }, (_, i) => (
                <option key={i} value={i}>Index {i}</option>
              ))}
            </select>
          )}
        </div>
        <div className="row mt">
          <button className="btn" onClick={onFire}>Fire</button>
          <button className="btn ghost" onClick={onRandomKey}>Random Key</button>
        </div>
      </div>
    </div>
  );
}
