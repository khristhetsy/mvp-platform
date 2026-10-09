/**
 * The import gate. Pure: the route loads the numbers, this decides.
 *
 * Order matches the admin Gatekeeping rules:
 *   suspended / paused  → nothing imports
 *   terms not accepted  → nothing imports (when required)
 *   free plan           → browse only
 *   daily cap           → at most what is left today (PT)
 *   plan hold limit     → at most what is left on the plan (when blocking is on)
 */
import type { DirectorySettings, FounderDirectoryAccess } from "@/lib/investor-directory/types";

export type ImportDecision =
  | { ok: true; allowed: number; trimmedBy: "none" | "daily_cap" | "hold_limit" }
  | { ok: false; reason: "suspended" | "paused" | "terms" | "free_plan" | "daily_cap" | "hold_limit" | "nothing_selected"; message: string };

export function decideImport(requested: number, access: FounderDirectoryAccess, settings: DirectorySettings): ImportDecision {
  if (requested <= 0) return { ok: false, reason: "nothing_selected", message: "Select investors to import." };
  if (access.status === "suspended") return { ok: false, reason: "suspended", message: "Directory access is suspended on your account. Contact support." };
  if (access.status === "paused") return { ok: false, reason: "paused", message: access.statusReason ?? "Directory imports are paused on your account. Contact support." };
  if (settings.require_terms && !access.termsAccepted) return { ok: false, reason: "terms", message: "Accept the terms of use before importing." };
  if (access.tier.hold_limit <= 0) return { ok: false, reason: "free_plan", message: "Your plan lets you browse the directory. Upgrade to hold directory contacts." };

  const leftToday = Math.max(0, settings.daily_cap - access.importedToday);
  const leftOnPlan = Math.max(0, access.tier.hold_limit - access.held);
  if (leftToday <= 0) return { ok: false, reason: "daily_cap", message: `You've reached today's limit of ${settings.daily_cap.toLocaleString("en-US")} imports. Try again tomorrow (PT).` };
  if (settings.block_over_limit && leftOnPlan <= 0) {
    return { ok: false, reason: "hold_limit", message: `Your plan holds ${access.tier.hold_limit.toLocaleString("en-US")} directory contacts and you're at the limit. Upgrade to hold more.` };
  }

  let allowed = Math.min(requested, leftToday);
  let trimmedBy: "none" | "daily_cap" | "hold_limit" = allowed < requested ? "daily_cap" : "none";
  if (settings.block_over_limit && allowed > leftOnPlan) { allowed = leftOnPlan; trimmedBy = "hold_limit"; }
  return { ok: true, allowed, trimmedBy };
}

/** Bounce rate in whole percent, or null when there are too few sends to judge. */
export function bounceRate(sent: number, bounced: number, minSends: number): number | null {
  if (sent < Math.max(1, minSends)) return null;
  return Math.round((bounced / sent) * 100);
}

export type UsageFlag = "normal" | "spike" | "review" | "paused" | "suspended";

/** One flag per founder for the Usage list. Status wins, then bounce review, then spikes. */
export function usageFlag(input: {
  status: "active" | "paused" | "suspended";
  importsInWindow: number;
  sent: number;
  bounced: number;
}, settings: DirectorySettings): UsageFlag {
  if (input.status === "suspended") return "suspended";
  if (input.status === "paused") return "paused";
  const rate = bounceRate(input.sent, input.bounced, settings.bounce_min_sends);
  if (rate !== null && rate > settings.bounce_pause_pct) return "review";
  if (input.importsInWindow > settings.spike_imports) return "spike";
  return "normal";
}

/** Start of "today" in Pacific time as an ISO instant (the platform runs on PT). */
export function startOfTodayPT(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = ((g("hour") * 60 + g("minute")) * 60 + g("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsed).toISOString();
}

/** Verified records older than this instant return to the verification queue. */
export function staleCutoff(staleDays: number, now: number = Date.now()): string {
  return new Date(now - staleDays * 86400000).toISOString();
}
