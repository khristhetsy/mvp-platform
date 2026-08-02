"use client";

/**
 * Opens the global DemoDialog via the `icapos:open-demo` window event (spec §5
 * Step 7). Server pages can drop this in anywhere a demo CTA belongs. Variant
 * controls styling only.
 */
export function BookDemoButton({
  label = "Book a 30-min demo",
  variant = "outline",
  className = "",
}: {
  label?: string;
  variant?: "solid" | "outline" | "onDark";
  className?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-site-blue text-white hover:bg-site-blue-hi"
      : variant === "onDark"
        ? "border border-white/20 text-white hover:border-site-blue-lt hover:text-site-blue-lt"
        : "border border-site-line text-site-navy hover:border-site-blue-hi hover:text-site-blue-hi";
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("icapos:open-demo"))}
      className={`rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      {label}
    </button>
  );
}
