/**
 * Interim iCapOS wordmark (spec §4). A clean, self-contained inline-SVG mark
 * (ring + two bars) plus the "iCapOS" lettering in the display font. Two
 * variants per the brand spec:
 *   - light  → on white/paper: "iCap" navy, "OS" blue-hi, mark blue.
 *   - dark   → knockout on navy: "iCap" white, "OS" + mark blue-lt.
 * Colours come from Tailwind tokens (currentColor on the SVG) — no inline styles.
 *
 * NOTE: this is a vector PLACEHOLDER. Swap in the official vector lockups when
 * they're delivered (§4, §17); the API (variant) can stay the same.
 */
export function SiteWordmark({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const dark = variant === "dark";
  const markColor = dark ? "text-site-blue-lt" : "text-site-blue";
  const word = dark ? "text-white" : "text-site-navy";
  const os = dark ? "text-site-blue-lt" : "text-site-blue-hi";
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label="iCapOS">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-5 w-5 ${markColor}`}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <rect x="7.5" y="10.1" width="9" height="1.9" rx="0.95" fill="currentColor" />
        <rect x="7.5" y="13.4" width="5.5" height="1.9" rx="0.95" fill="currentColor" />
      </svg>
      <span className={`font-site-display text-lg font-extrabold tracking-tight ${word}`}>
        iCap<span className={os}>OS</span>
      </span>
    </span>
  );
}
