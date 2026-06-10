export function DonutProgress({
  percent,
  size = 56,
  strokeWidth = 6,
  label,
  strokeColor = "var(--blue)",
}: Readonly<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  strokeColor?: string;
}>) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e6ed"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-slate-950">
        {label ?? `${clamped}%`}
      </span>
    </div>
  );
}
