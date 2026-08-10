"use client";

/**
 * Launches AI-first mode (spec §8) via the `icapos:open-ai-first` window event.
 * Drop into any server page where a "talk to it instead of clicking" entry
 * belongs. `variant` controls styling only.
 */
export function AiModeLauncher({
  label = "Explore with AI",
  variant = "onDark",
  className = "",
}: {
  label?: string;
  variant?: "solid" | "onDark";
  className?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-site-blue text-white hover:bg-site-blue-hi"
      : "border border-white/20 text-white hover:border-site-blue-lt hover:text-site-blue-lt";
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("icapos:open-ai-first"))}
      className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      <span aria-hidden="true"><i className="ti ti-sparkles" aria-hidden="true" /></span> {label}
    </button>
  );
}
