"use client";

/**
 * Opens the global DemoDialog in "Managed IR" mode (a meeting with the named
 * host) via the `icapos:open-demo` event — used by the pricing page's Managed IR
 * "Talk to us" CTA instead of navigating away. Styling matches the tier CTA.
 */
export function TalkToUsButton({
  label,
  className = "",
  host = "Khris Thetsy",
}: {
  label: string;
  className?: string;
  host?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("icapos:open-demo", { detail: { mode: "managed_ir", host } }))}
      className={className}
    >
      {label}
    </button>
  );
}
