import { useMemo, useRef } from "react";
import { uid } from "../logic/utils";
import type { Server } from "../logic/types";

type Props = {
  servers: Server[];
  assignments: Record<string, string[]>;
  lastRoutedId: string | null;
  onFire: () => void;           // fire one request using current key/strategy
  width?: number;
  height?: number;
  radius?: number;
};

function placeOnCircle(servers: Server[], cx: number, cy: number, r: number) {
  // stable, intuitive ordering by port (ascending), so labels go 0..N-1 clockwise
  const ordered = [...servers].sort((a, b) => a.port - b.port);

  return ordered.map((s, i) => {
    const angle = (2 * Math.PI * i) / Math.max(ordered.length, 1) - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { server: s, x, y, angle };
  });
}

export default function RingVisualizer({
  servers,
  assignments,
  lastRoutedId,
  onFire,
  width = 820,
  height = 520,
  radius = 210,
}: Props) {
  const center = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height]);
  const layout = useMemo(() => placeOnCircle(servers, center.x, center.y, radius), [servers, center.x, center.y, radius]);
  const arrowId = useRef(uid()).current;

  const lastNode = useMemo(() => {
    if (!lastRoutedId) return null;
    return layout.find(n => n.server.id === lastRoutedId) || null;
  }, [lastRoutedId, layout]);

  return (
    <div className="card" style={{ overflow: "visible" }}>
      <svg
        width={width}
        height={height}
        className="block mx-auto"
        style={{ overflow: "visible" }}
      >
        {/* ring */}
        <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={2} />

        {/* source (click to fire) */}
        <g
          onClick={onFire}
          style={{ cursor: "pointer" }}
        >
          <circle cx={center.x} cy={center.y} r={26} fill="#0ea5e9" />
          <text x={center.x} y={center.y + 4} textAnchor="middle" fontSize="12" fill="#fff">
            source
          </text>
        </g>

        {/* dashed animated arrow */}
        <defs>
          <marker id={`arrow-${arrowId}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#0ea5e9" />
          </marker>
        </defs>
        {lastNode && (
          <line
            x1={center.x}
            y1={center.y}
            x2={lastNode.x}
            y2={lastNode.y}
            stroke="#0ea5e9"
            strokeWidth={3}
            strokeDasharray="6 6"
            markerEnd={`url(#arrow-${arrowId})`}
          >
            <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.6s" fill="freeze" />
          </line>
        )}

        {/* servers */}
        {layout.map(({ server, x, y }, idx) => (
          <g key={server.id}>
            <circle cx={x} cy={y} r={28} fill={server.id === lastRoutedId ? "#22c55e" : "#111827"} />
            <text x={x} y={y - 18} textAnchor="middle" fontSize="10" fill="#64748b">{idx}</text>
            <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="#fff">{server.port}</text>
            {/* badge below node */}
            <rect x={x - 18} y={y + 30} width="36" height="16" rx="8" fill="#ffffff" stroke="#e5e7eb" />
            <text x={x} y={y + 42} textAnchor="middle" fontSize="10" fill="#334155">
              {(assignments[server.id]?.length || 0)} keys
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
