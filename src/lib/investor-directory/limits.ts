/**
 * The import gate. Pure: the route loads the numbers, this decides.
 *
 * Order matches the admin Gatekeeping rules:
 *   suspended / paused  → nothing imports
 *   terms not accepted  → nothing imports (when required)
 *   no contact space    → browse only (Free plan)
 *   daily cap           → at most what is left today (PT)
 *   contact limit       → at most what is left of the plan (when blocking is on)
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
  const limit = access.limits.contacts;
  if (limit <= 0) return { ok: false, reason: "free_plan", message: "Your plan lets you browse the directory. Basic and up let you add investors." };

  const leftToday = Math.max(0, settings.daily_cap - access.importedToday);
  const leftOnPlan = Math.max(0, limit - access.held);
  if (leftToday <= 0) return { ok: false, reason: "daily_cap", message: `You've reached today's limit of ${settings.daily_cap.toLocaleString("en-US")} imports. Try again tomorrow (PT).` };
  if (settings.block_over_limit && leftOnPlan <= 0) {
    return { ok: false, reason: "hold_limit", message: `You hold ${access.held.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} investors, the most your plan allows. Archive investors you no longer need, or move to a bigger plan.` };
  }

  let allowed = Math.min(requested, leftToday);
  let trimmedBy: "none" | "daily_cap" | "hold_limit" = allowed < requested ? "daily_cap" : "none";
  if (settings.block_over_limit && allowed > leftOnPlan) { allowed = leftOnPlan; trimmedBy = "hold_limit"; }
  return { ok: true, allowed, trimmedBy };
}

/**
 * One investor limit for every source (directory, Form D, LinkedIn, CSV or
 * Excel, added by hand). Introductions from iCFO don't count.
 */
export type HoldStatus = {
  held: number;
  max: number;
  left: number;
  planLabel: string;
  /** False when the admin turned off blocking over the limit. */
  enforced: boolean;
  /** The next plan up and what it holds, or null on the top plan. */
  nextPlan: { label: string; contacts: number } | null;
};

export function holdStatus(input: {
  held: number;
  max: number;
  planLabel: string;
  enforced: boolean;
  plans: { label: string; contacts: number }[];
}): HoldStatus {
  const max = Math.max(0, input.max);
  const next = input.plans.filter((p) => p.contacts > max).sort((a, b) => a.contacts - b.contacts)[0];
  return {
    held: input.held,
    max,
    left: input.enforced ? Math.max(0, max - input.held) : Number.MAX_SAFE_INTEGER,
    planLabel: input.planLabel,
    enforced: input.enforced,
    nextPlan: next ? { label: next.label, contacts: next.contacts } : null,
  };
}

/** How many of `requested` new investors fit, or why none do. */
export function decideAdd(requested: number, hold: HoldStatus): { ok: true; allowed: number } | { ok: false; message: string } {
  if (!hold.enforced) return { ok: true, allowed: requested };
  const n = (v: number) => v.toLocaleString("en-US");
  const next = hold.nextPlan ? ` Or move to ${hold.nextPlan.label} for up to ${n(hold.nextPlan.contacts)}.` : "";
  if (hold.max <= 0) return { ok: false, message: `Your plan doesn't include adding investors. Basic and up let you add investors.` };
  if (hold.left <= 0) {
    return { ok: false, message: `You hold ${n(hold.held)} of ${n(hold.max)} investors on ${hold.planLabel}, the most your plan allows. Archive investors you no longer need.${next}` };
  }
  return { ok: true, allowed: Math.min(requested, hold.left) };
}

/**
 * Directory import where some ids are Form D firms. Form D firms (no contact
 * email) don't count toward the plan's limit, so they only face the gates and
 * the daily cap; the rest also face the limit. Returns the ids to import, in
 * order: Form D firms first, then the counted ones that fit.
 */
export function decideSplitImport(
  ids: string[],
  formd: Set<string>,
  access: FounderDirectoryAccess,
  settings: DirectorySettings,
): { ok: true; ids: string[]; limit: number; trimmedBy: "none" | "daily_cap" | "hold_limit" } | { ok: false; reason: Extract<ImportDecision, { ok: false }>["reason"]; message: string } {
  const free = ids.filter((id) => formd.has(id));
  const counted = ids.filter((id) => !formd.has(id));
  // Gates and the daily cap apply to everything; the plan's limit is checked below.
  const gate = decideImport(ids.length, { ...access, held: 0 }, { ...settings, block_over_limit: false });
  if (!gate.ok) return gate;
  let trimmedBy: "none" | "daily_cap" | "hold_limit" = gate.trimmedBy;
  let countedAllowed = counted.length;
  if (counted.length > 0) {
    const hold = decideImport(counted.length, access, settings);
    if (!hold.ok) {
      if (hold.reason !== "hold_limit" || free.length === 0) return hold;
      countedAllowed = 0;
      trimmedBy = "hold_limit";
    } else {
      countedAllowed = hold.allowed;
      if (hold.trimmedBy !== "none") trimmedBy = hold.trimmedBy;
    }
  }
  const ordered = [...free, ...counted.slice(0, countedAllowed)];
  return { ok: true, ids: ordered, limit: Math.min(gate.allowed, ordered.length), trimmedBy };
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
