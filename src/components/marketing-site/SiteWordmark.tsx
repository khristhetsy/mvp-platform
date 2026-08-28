/**
 * iCapOS logo lockup. Renders the real brand asset:
 *   - light → the full-colour lockup (icapos-logo.svg), for light/white surfaces.
 *   - dark  → a white knockout (icapos-logo-white.png), for navy/dark surfaces.
 * The `variant`/`className` API is unchanged from the earlier placeholder, so
 * every call site keeps working. Default height ~32px suits the nav/footer;
 * pass an `h-*` class to override.
 */
export function SiteWordmark({
  variant = "light",
  className = "h-8 w-auto",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const src = variant === "dark" ? "/icapos-logo-white.png" : "/icapos-logo.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="iCapOS" className={className} />;
}
