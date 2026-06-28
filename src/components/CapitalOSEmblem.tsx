/** iCapOS emblem — a broken ring around ascending bars, navy→blue gradient.
 *  Pure SVG (no image asset, no hooks) so it renders anywhere and scales crisply. */
export function CapitalOSEmblem({
  size = 32,
  className = "",
}: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="iCapOS emblem"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="icapos-emblem-grad" x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B2A5B" />
          <stop offset="1" stopColor="#2E7CF6" />
        </linearGradient>
      </defs>

      {/* Broken ring (gap at upper-right) */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="url(#icapos-emblem-grad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="214 38"
        transform="rotate(-58 50 50)"
      />

      {/* Ascending bars */}
      <g fill="url(#icapos-emblem-grad)">
        <rect x="31" y="58" width="7.5" height="16" rx="2" />
        <rect x="42" y="50" width="7.5" height="24" rx="2" />
        <rect x="53" y="42" width="7.5" height="32" rx="2" />
        <rect x="64" y="34" width="7.5" height="40" rx="2" />
      </g>
    </svg>
  );
}
