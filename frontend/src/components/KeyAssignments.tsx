
import type { Server } from "../logic/types";

export default function KeyAssignments({
  servers,
  assigned
}: {
  servers: Server[];
  assigned: Record<string, string[]>;
}) {
  return (
    <div className="card">
      <div className="section-title">Current key assignments (by server)</div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Server</th><th>Keys</th></tr>
          </thead>
          <tbody>
            {servers.map(s => (
              <tr key={s.id} className="top">
                <td className="mono nowrap">{s.id}</td>
                <td>
                  {(assigned[s.id] && assigned[s.id].length > 0) ? (
                    <span className="mono">{assigned[s.id].join(', ')}</span>
                  ) : <span className="muted">(none)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
