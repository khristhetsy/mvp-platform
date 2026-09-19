/**
 * The score ring — one arc, used wherever a 0–100 figure wants reading at a glance.
 *
 * Lifted out of FounderReadinessDonutCards so the pipeline cards, the readiness
 * donuts and the CRR surfaces all draw the same shape. Pure SVG, no dependency,
 * safe in a server component.
 *
 * A null score is NOT a zero: it draws an empty track with an em dash, because
 * "not scored" and "scored zero" are different claims about an investor.
 */

/** The bands the pipeline and the matcher already use. */
export function scoreBandColor(score: number): string {
  if (score >= 70) return "#0F6E56";
  if (score >= 40) return "#BA7517";
  return "#94A3B8";
}

export function ScoreRing({
  score,
  size = 44,
  color,
  sublabel,
  label,
  track = "#EEEDFE",
  title,
}: {
  /** 0–100, or null when the record has never been scored. */
  score: number | null | undefined;
  size?: number;
  /** Override the band colour. */
  color?: string;
  /** Small caption under the number, e.g. "match". */
  sublabel?: string;
  /** Replaces the number in the middle; pass "" to draw the arc alone. */
  label?: string;
  track?: string;
  /** Accessible description. Defaults to "<n>% match" / "not scored". */
  title?: string;
}) {
  const scored = typeof score === "number" && Number.isFinite(score);
  const value = scored ? Math.max(0, Math.min(100, score)) : 0;
  const stroke = color ?? (scored ? scoreBandColor(value) : "#CBD5E1");

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.375;
  const sw = size * 0.125;

  // A real 0 still gets a sliver, so it never looks like "not scored".
  const p = scored ? Math.max(0.01, Math.min(0.999, value / 100)) : 0;
  const a1 = -Math.PI / 2;
  const a2 = p * 2 * Math.PI - Math.PI / 2;
  const x1 = (cx + r * Math.cos(a1)).toFixed(2);
  const y1 = (cy + r * Math.sin(a1)).toFixed(2);
  const x2 = (cx + r * Math.cos(a2)).toFixed(2);
  const y2 = (cy + r * Math.sin(a2)).toFixed(2);
  const large = p > 0.5 ? 1 : 0;

  const middle = label ?? (scored ? String(Math.round(value)) : "—");
  const hasSub = Boolean(sublabel);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title ?? (scored ? `${Math.round(value)}% match` : "Not scored")}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={sw} />
      {p > 0 && (
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {middle !== "" && (
        <text
          x={cx}
          y={cy + (hasSub ? 0 : size * 0.09)}
          textAnchor="middle"
          fontSize={size * (hasSub ? 0.26 : 0.3)}
          fontWeight={600}
          fill={stroke}
        >
          {middle}
        </text>
      )}
      {hasSub && (
        <text x={cx} y={cy + size * 0.27} textAnchor="middle" fontSize={size * 0.15} fill="#94A3B8">
          {sublabel}
        </text>
      )}
    </svg>
  );
}
