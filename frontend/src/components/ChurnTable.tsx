
type Diff = {
  moved: number;
  total: number;
  rows: { k: string; b: string; a: string; changed: boolean }[];
};

export default function ChurnTable({ diff }: { diff: Diff | null }) {
  return (
    <div className="card">
      <div className="section-title">Churn (Before → After)</div>
      {!diff ? (
        <p className="muted">
          Fire some requests first, then <b>Add Server</b> or <b>Remove Server</b> to see how those keys remap.
        </p>
      ) : (
        <>
          <p className="muted">Moved <b>{diff.moved}</b> of {diff.total} keys</p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th className="left">Key</th>
                  <th className="left">Before</th>
                  <th className="left">After</th>
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((r) => (
                  <tr key={r.k} className={r.changed ? "moved" : ""}>
                    <td className="mono">{r.k}</td>
                    <td className="mono">{r.b}</td>
                    <td className="mono">
                      {r.a}
                      {r.changed ? "  ← moved" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
