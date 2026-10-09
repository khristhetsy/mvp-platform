/**
 * Plan allowances for the investor directory and the Manual outreach email cap.
 * Pure: the server loads the numbers, these decide.
 *
 * Each founder plan includes directory contact space and a number of Manual
 * outreach emails per 30 day period (the same window as the plan's investor
 * reach limit, counted from signup). A top up adds to both.
 */
import type { DirectoryPlanAllowance, DirectoryTier } from "@/lib/investor-directory/types";

export const DEFAULT_ALLOWANCES: DirectoryPlanAllowance[] = [
  { plan_type: "founder_free", label: "Free", contacts: 0, emails_per_month: 0, sort: 0 },
  { plan_type: "founder_basic", label: "Basic", contacts: 500, emails_per_month: 1000, sort: 1 },
  { plan_type: "founder_professional", label: "Professional", contacts: 10000, emails_per_month: 20000, sort: 2 },
  { plan_type: "founder_premium", label: "Premium", contacts: 20000, emails_per_month: 40000, sort: 3 },
];

/**
 * Which allowance row a subscription plan reads. The legacy free trial reads
 * Basic (as Automated outreach does); the SPV Program and internal staff
 * accounts read Premium; anything else reads Free.
 */
export function allowanceKeyFor(plan: string | null | undefined): string {
  switch (plan) {
    case "founder_basic":
    case "founder_trial":
      return "founder_basic";
    case "founder_professional":
      return "founder_professional";
    case "founder_premium":
    case "founder_managed_ir":
    case "admin_internal":
      return "founder_premium";
    default:
      return "founder_free";
  }
}

export function pickAllowance(rows: DirectoryPlanAllowance[], plan: string | null | undefined): DirectoryPlanAllowance {
  const key = allowanceKeyFor(plan);
  return rows.find((r) => r.plan_type === key)
    ?? DEFAULT_ALLOWANCES.find((r) => r.plan_type === key)
    ?? DEFAULT_ALLOWANCES[0];
}

/** Plan allowance plus top up. */
export function addUp(allowance: DirectoryPlanAllowance, topUp: DirectoryTier): { contacts: number; emails: number } {
  return {
    contacts: Math.max(0, allowance.contacts) + Math.max(0, topUp.hold_limit),
    emails: Math.max(0, allowance.emails_per_month) + Math.max(0, topUp.email_limit ?? 0),
  };
}

export type EmailCapDecision =
  | { ok: true; remaining: number }
  | { ok: false; reason: "cap_reached" | "over_cap"; cap: number; used: number; remaining: number; adding: number };

/**
 * May a Manual outreach start add `adding` new recipients? Each new recipient's
 * first email goes out on the next send pass, so it must fit what is left.
 * Later steps are held by the send pass when the cap is reached.
 */
export function decideEmailStart(cap: number, used: number, adding: number): EmailCapDecision {
  const remaining = Math.max(0, cap - used);
  if (adding <= 0) return { ok: true, remaining };
  if (remaining <= 0) return { ok: false, reason: "cap_reached", cap, used, remaining, adding };
  if (adding > remaining) return { ok: false, reason: "over_cap", cap, used, remaining, adding };
  return { ok: true, remaining };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Founder facing message for a refused start. `resets` is already formatted (PT). */
export function emailCapMessage(d: Extract<EmailCapDecision, { ok: false }>, resets: string): string {
  if (d.reason === "cap_reached") {
    return `You've sent ${fmt(d.used)} of ${fmt(d.cap)} emails this period. Sending resumes ${resets}. Add a top up or move to a bigger plan for more.`;
  }
  const remove = d.adding - d.remaining;
  return `${fmt(d.remaining)} emails left this period, and this would start ${fmt(d.adding)} new investors. Remove ${fmt(remove)} recipient${remove === 1 ? "" : "s"} or add a top up.`;
}

/** How many sends the send pass may make for one founder this run. */
export function sendBudget(cap: number, used: number): number {
  return Math.max(0, cap - used);
}
