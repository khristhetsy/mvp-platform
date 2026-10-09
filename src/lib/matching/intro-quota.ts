/**
 * How many introduction requests a founder has used against their plan's caps.
 *
 * One reader for the API route that enforces the caps and the matches page that
 * displays them, so the numbers a founder sees are the numbers they are held to.
 * Counts exactly as POST /api/founder/matching/intro does: member intro requests
 * (by company, declined ones given back) plus CRM prospect intro requests (by
 * founder). Keep the two in step.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFounderConnectionConfig } from "@/lib/settings/platform-settings";
import type { PlanType } from "@/lib/subscriptions/plans";
import { founderCapPeriod } from "@/lib/outreach/investor-cap";

export type IntroQuota = {
  /**
   * The plan's "monthly" limit, counted over the founder's current 30 day period
   * from their signup date (the same cycle as the outreach allowance), not the
   * calendar month. resetsAt is when the next period starts.
   */
  month: { used: number; cap: number; resetsAt: string };
  /** null when the plan has no weekly cap. */
  week: { used: number; cap: number } | null;
  isProfessional: boolean;
};

/** First instant of the current UTC month. (Intro limits now use the 30 day signup period; see loadIntroQuota.) */
export function monthStartUtc(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Monday 00:00 UTC of the current week. */
export function weekStartUtc(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString();
}

/**
 * Declined member requests and dismissed prospect requests are refunded (not counted).
 * Only requests the founder sent count: introductions an investor asked for are not
 * charged to the founder's plan.
 */
export async function countIntroRequestsSince(
  admin: SupabaseClient,
  companyId: string,
  founderId: string,
  since: string,
): Promise<number> {
  const [member, prospect, pipeline] = await Promise.all([
    admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("direction", "founder_to_investor").neq("status", "declined").gte("created_at", since),
    admin.from("prospect_intro_requests").select("id", { count: "exact", head: true }).eq("founder_id", founderId).neq("status", "dismissed").gte("created_at", since),
    // Intro requests the founder opened from their pipeline: a message thread the
    // founder created with a platform investor. Investor opened threads don't count.
    admin.from("message_threads").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("created_by", founderId).is("intro_request_id", null).gte("created_at", since),
  ]);
  return (member.count ?? 0) + (prospect.count ?? 0) + (pipeline.count ?? 0);
}

export async function loadIntroQuota(
  admin: SupabaseClient,
  input: { companyId: string; founderId: string; plan: PlanType | null | undefined },
): Promise<IntroQuota> {
  const cfg = await getFounderConnectionConfig();
  // Premium uses Professional's limits.
  const isProfessional = input.plan === "founder_professional" || input.plan === "founder_premium";
  const monthCap = isProfessional ? cfg.monthlyByPlan.professional : cfg.monthlyByPlan.basic;
  const weekCap = cfg.weeklyByPlan ? (isProfessional ? cfg.weeklyByPlan.professional : cfg.weeklyByPlan.basic) : null;
  const period = await founderCapPeriod(admin, input.founderId);
  const [monthUsed, weekUsed] = await Promise.all([
    countIntroRequestsSince(admin, input.companyId, input.founderId, period.start.toISOString()),
    weekCap === null
      ? Promise.resolve(0)
      : countIntroRequestsSince(admin, input.companyId, input.founderId, weekStartUtc()),
  ]);
  return {
    month: { used: monthUsed, cap: monthCap, resetsAt: period.end.toISOString() },
    week: weekCap === null ? null : { used: weekUsed, cap: weekCap },
    isProfessional,
  };
}

/** Which cap a new request would break, or null when it fits both. Week first, as the route checks. */
export function capReached(quota: IntroQuota): "week" | "month" | null {
  if (quota.week && quota.week.used >= quota.week.cap) return "week";
  if (quota.month.used >= quota.month.cap) return "month";
  return null;
}
