const BAR_COLOR = "var(--primary)";

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="bar-label">{d.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <div className="bar-value">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ points, xLabel, yLabel }: { points: { x: number; y: number }[]; xLabel: string; yLabel: string }) {
  if (points.length === 0) return <p className="empty-state">No data yet.</p>;

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 28, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xMax = Math.max(...points.map((p) => p.x), 1);
  const yMax = Math.max(...points.map((p) => p.y), 1) * 1.1;

  const toX = (x: number) => padding.left + (x / xMax) * innerW;
  const toY = (y: number) => padding.top + innerH - (y / yMax) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} by ${xLabel}`} style={{ width: "100%", height: "auto" }}>
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--border)" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--border)" />
      <path d={path} fill="none" stroke={BAR_COLOR} strokeWidth={2} />
      {points.map((p) => (
        <circle key={p.x} cx={toX(p.x)} cy={toY(p.y)} r={3} fill={BAR_COLOR} />
      ))}
      <text x={padding.left} y={height - 6} fontSize={11} fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={4} y={padding.top + 8} fontSize={11} fill="var(--text-muted)">
        {yLabel}
      </text>
    </svg>
  );
}
