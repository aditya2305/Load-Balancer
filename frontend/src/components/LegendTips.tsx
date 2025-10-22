
export default function LegendTips() {
  return (
    <div className="card">
      <div className="section-title">Legend</div>
      <ul className="list">
        <li>Blue circle = source</li>
        <li>Dark/Green nodes = servers (green = last target)</li>
        <li>Dashed line = request path</li>
        <li>Ring is for visualization</li>
      </ul>
      <div className="section-title mt">Try these scenarios</div>
      <ul className="list">
        <li>Pick <i>Simple Hash</i>, set key <code>10.0.0.1</code>, fire multiple → always same server.</li>
        <li>Switch to <i>Consistent Hash</i>, <b>Add Server</b> → see few of your fired keys move.</li>
        <li>Switch to <i>Simple Hash</i>, <b>Add Server</b> → see many keys move.</li>
        <li>Use <b>Random Key</b> to simulate many clients.</li>
      </ul>
    </div>
  );
}
