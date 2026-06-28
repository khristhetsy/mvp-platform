/**
 * iCapOS brand lockup — renders the official logo asset (public/icapos-logo.svg).
 * The asset is the full horizontal lockup (emblem + wordmark + tagline).
 * Props are kept for call-site compatibility; the asset is the source of truth.
 */
const LOGO_RATIO = 713 / 200; // master artwork aspect ratio

export function CapitalOSLogo({
  className = "",
  height = 32,
  priority = false,
}: Readonly<{
  className?: string;
  height?: number;
  priority?: boolean;
  /** Kept for compatibility — the asset already includes the tagline lockup. */
  variant?: "full" | "stacked";
  tagline?: boolean;
}>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icapos-logo.svg"
      alt="iCapOS"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className={`w-auto object-contain object-left ${className}`}
      style={{ height, width: "auto", maxWidth: "100%" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
