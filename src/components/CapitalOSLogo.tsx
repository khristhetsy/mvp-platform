import { CapitalOSEmblem } from "@/components/CapitalOSEmblem";

/**
 * iCapOS brand lockup, rendered as native SVG + text (no image asset).
 * variant="full" = horizontal (default); variant="stacked" = vertical with tagline.
 */
export function CapitalOSLogo({
  className = "",
  height = 32,
  variant = "full",
}: Readonly<{
  className?: string;
  height?: number;
  variant?: "full" | "stacked";
  /** Accepted for call-site compatibility; SVG needs no image preloading. */
  priority?: boolean;
}>) {
  const wordmark = (
    <span
      style={{ fontSize: height * 0.66, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}
      className="select-none"
    >
      <span style={{ color: "#0A2540" }}>iCap</span>
      <span style={{ color: "#2E7CF6" }}>OS</span>
    </span>
  );

  if (variant === "stacked") {
    return (
      <span className={`inline-flex flex-col items-center gap-2 ${className}`} aria-label="iCapOS">
        <CapitalOSEmblem size={height} />
        {wordmark}
        <span
          style={{ fontSize: Math.max(8, height * 0.13), letterSpacing: "0.18em", color: "#0A2540" }}
          className="font-medium uppercase opacity-80"
        >
          The operating system for capital
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="iCapOS">
      <CapitalOSEmblem size={height} />
      {wordmark}
    </span>
  );
}
