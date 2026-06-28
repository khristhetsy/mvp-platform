import { CapitalOSEmblem } from "@/components/CapitalOSEmblem";

/**
 * iCapOS brand lockup, rendered as native SVG + text (no image asset).
 * variant="full" = horizontal (default); variant="stacked" = vertical.
 * tagline = show the "THE OPERATING SYSTEM FOR CAPITAL" strapline (marketing lockup).
 */
export function CapitalOSLogo({
  className = "",
  height = 32,
  variant = "full",
  tagline = false,
}: Readonly<{
  className?: string;
  height?: number;
  variant?: "full" | "stacked";
  tagline?: boolean;
  /** Accepted for call-site compatibility; SVG needs no image preloading. */
  priority?: boolean;
}>) {
  const wordmark = (
    <span
      style={{ fontSize: height * 0.66, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}
      className="select-none whitespace-nowrap"
    >
      <span style={{ color: "#0A2540" }}>iCap</span>
      <span style={{ color: "#2E7CF6" }}>OS</span>
    </span>
  );

  const strapline = (
    <span
      style={{ fontSize: Math.max(7, height * 0.135), letterSpacing: "0.16em", color: "#0A2540" }}
      className="select-none whitespace-nowrap font-medium uppercase opacity-80"
    >
      The operating system for capital
    </span>
  );

  if (variant === "stacked") {
    return (
      <span className={`inline-flex flex-col items-center gap-2 ${className}`} aria-label="iCapOS">
        <CapitalOSEmblem size={height} />
        {wordmark}
        {strapline}
      </span>
    );
  }

  // Horizontal lockup — optionally with a divider + strapline beneath the wordmark.
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="iCapOS">
      <CapitalOSEmblem size={height} />
      {tagline ? (
        <span className="inline-flex flex-col">
          {wordmark}
          <span className="my-1 h-px w-full bg-[#0A2540]/30" aria-hidden />
          {strapline}
        </span>
      ) : (
        wordmark
      )}
    </span>
  );
}
