// Circular gauge for an investor's Partner Score / rating. Pure presentational
// component (no client hooks) — safe in server and client components. The arc
// fills to the score (0–100) and its color deepens by tier band; an unrated
// investor renders an empty grey track with an em dash.

export type RatingRingProps = {
  score: number | null;
  /** Diameter in px. */
  size?: number;
  /** Arc/track thickness in px. Defaults to a size-appropriate value. */
  stroke?: number;
  /** Show the numeric value (or em dash) in the center. */
  showValue?: boolean;
};

/** Ring color by score band — matches tierFromScore (Emerging/Active/Established/Premier). */
export function ringColor(score: number | null): string {
  if (score == null) return "#B4B2A9"; // unrated — neutral grey
  if (score >= 80) return "#0C447C"; // Premier
  if (score >= 60) return "#185FA5"; // Established
  if (score >= 40) return "#378ADD"; // Active
  return "#85B7EB"; // Emerging
}

const TRACK = "#E3E8F2";

export function RatingRing({ score, size = 34, stroke, showValue = true }: Readonly<RatingRingProps>) {
  const sw = stroke ?? Math.max(3, Math.round(size * 0.11));
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const offset = c * (1 - pct);
  const mid = size / 2;
  const fontSize = Math.max(10, Math.round(size * 0.34));
  const label = score == null ? "Unrated" : `Investor rating ${Math.round(score)} of 100`;

  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={mid} cy={mid} r={r} fill="none" stroke={TRACK} strokeWidth={sw} />
        {score != null && (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            stroke={ringColor(score)}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
      </svg>
      {showValue && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize,
            fontWeight: 500,
            color: score == null ? "#94A3B8" : "#0f172a",
            lineHeight: 1,
          }}
        >
          {score == null ? "—" : Math.round(score)}
        </span>
      )}
    </span>
  );
}
