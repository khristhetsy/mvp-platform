/** Formatting shared by server pages and client components. Pure. */

/** Date (and optionally time) in Pacific time, the platform clock. */
export function fmtPT(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(iso)) + (withTime ? " PT" : "");
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export type Tone = "ok" | "warn" | "bad" | "info" | "pro" | "mute";

/** "Basic +1k" from the plan label and the top up label. */
export function planLabel(plan: string, topUp: string): string {
  return topUp && topUp !== "No top up" && topUp !== "Free" ? `${plan} ${topUp.replace(/^Directory /, "")}` : plan;
}
