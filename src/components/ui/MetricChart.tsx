export type MetricChartData = {
  /** Oldest first. The last point is the current reading. */
  values: number[];
  /** Top of the scale. */
  max: number;
  unit: string;
  /** Dashed limit lines. */
  limits?: { value: number; label: string; tone: "warn" | "bad" }[];
  /** Shaded normal range and the average line. */
  band?: { lo: number; hi: number; avg: number };
  /** Captions for the two ends of the time axis. */
  startLabel?: string;
  endLabel?: string;
};

const TONE = { warn: "#b45309", bad: "#dc2626" } as const;

/** A small line graph with limit lines and a normal band. Plain SVG, no data fetching. */
export function MetricChart({ data }: Readonly<{ data: MetricChartData }>) {
  const { values, max, limits = [], band } = data;
  if (values.length < 2) {
    return <p className="mt-4 text-[12.5px] text-slate-500">Not enough readings yet to draw a graph.</p>;
  }
  const W = 320, L = 34, R = 316, T = 10, B = 110;
  const x = (i: number) => L + ((R - L) * i) / (values.length - 1);
  const y = (v: number) => B - ((B - T) * Math.min(Math.max(v, 0), max)) / max;
  const last = values[values.length - 1]!;
  const ticks = [0, max / 2, max];
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W + 20} 140`} width="100%" role="img" aria-label={`Graph of the last ${values.length} readings, now ${fmt(last)} ${data.unit}`}>
        {band ? (
          <>
            <rect x={L} y={y(band.hi)} width={R - L} height={Math.max(y(band.lo) - y(band.hi), 1)} fill="#22c55e" opacity="0.14" />
            <line x1={L} y1={y(band.avg)} x2={R} y2={y(band.avg)} stroke="#16a34a" strokeWidth="1.2" />
          </>
        ) : null}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} y1={y(t)} x2={R} y2={y(t)} stroke="#e2e8f0" />
            <text x={L - 4} y={y(t) + 3} fontSize="9" fill="#64748b" textAnchor="end">{fmt(t)}{data.unit === "s" || data.unit === "ms" ? ` ${data.unit}` : ""}</text>
          </g>
        ))}
        {limits.map((l) => (
          <g key={l.label}>
            <line x1={L} y1={y(l.value)} x2={R} y2={y(l.value)} stroke={TONE[l.tone]} strokeDasharray="5 4" />
            <text x={L + 3} y={y(l.value) - 3} fontSize="9" fill={TONE[l.tone]}>{l.label}</text>
          </g>
        ))}
        <polyline fill="none" stroke="#1A6CE4" strokeWidth="2" strokeLinejoin="round" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        <circle cx={x(values.length - 1)} cy={y(last)} r="4" fill="#1A6CE4" />
        <text x={L} y="128" fontSize="9" fill="#64748b">{data.startLabel ?? "Earlier"}</text>
        <text x={R} y="128" fontSize="9" fill="#64748b" textAnchor="end">{data.endLabel ?? "Now"}</text>
      </svg>
      {band ? (
        <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-500">
          <span><i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm bg-emerald-500/40 align-middle" />Normal range</span>
          <span><i className="mr-1.5 inline-block h-0.5 w-3.5 bg-emerald-600 align-middle" />7 day average</span>
        </p>
      ) : null}
    </div>
  );
}
