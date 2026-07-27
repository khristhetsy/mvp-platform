/**
 * Circular Investable Score gauge for the investor one-pager and founder
 * preview. Inline-styled (these pages use inline styles, not Tailwind) and
 * dependency-free so it renders on the public page. The caption frames the
 * number as a readiness signal, not a rating of the securities.
 */
export function InvestableScoreBadge({
  score,
  size = 66,
  stroke = "#4338CA",
}: {
  score: number;
  size?: number;
  stroke?: string;
}) {
  const r = 33;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={`Investable score ${clamped} of 100`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#EEF2F8" strokeWidth={9} />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="38" textAnchor="middle" fontSize="20" fontWeight="600" fill="#0f172a">
          {clamped}
        </text>
        <text x="40" y="52" textAnchor="middle" fontSize="8" fill="#94a3b8">
          / 100
        </text>
      </svg>
      <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "#94a3b8", marginTop: 4 }}>
        Investable Score
      </span>
      <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>Readiness signal</span>
    </div>
  );
}
