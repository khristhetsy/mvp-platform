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

export type IntroQuota = {
  month: { used: number; cap: number };
  /** null when the plan has no weekly cap. */
  week: { used: number; cap: number } | null;
  isProfessional: boolean;
};

/** First instant of the current UTC month. */
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

/** Declined member requests and dismissed prospect requests are refunded (not counted). */
export async function countIntroRequestsSince(
  admin: SupabaseClient,
  companyId: string,
  founderId: string,
  since: string,
): Promise<number> {
  const [member, prospect] = await Promise.all([
    admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId).neq("status", "declined").gte("created_at", since),
    admin.from("prospect_intro_requests").select("id", { count: "exact", head: true }).eq("founder_id", founderId).neq("status", "dismissed").gte("created_at", since),
  ]);
  return (member.count ?? 0) + (prospect.count ?? 0);
}

export async function loadIntroQuota(
  admin: SupabaseClient,
  input: { companyId: string; founderId: string; plan: PlanType | null | undefined },
): Promise<IntroQuota> {
  const cfg = await getFounderConnectionConfig();
  const isProfessional = input.plan === "founder_professional";
  const monthCap = isProfessional ? cfg.monthlyByPlan.professional : cfg.monthlyByPlan.basic;
  const weekCap = cfg.weeklyByPlan ? (isProfessional ? cfg.weeklyByPlan.professional : cfg.weeklyByPlan.basic) : null;
  const [monthUsed, weekUsed] = await Promise.all([
    countIntroRequestsSince(admin, input.companyId, input.founderId, monthStartUtc()),
    weekCap === null
      ? Promise.resolve(0)
      : countIntroRequestsSince(admin, input.companyId, input.founderId, weekStartUtc()),
  ]);
  return {
    month: { used: monthUsed, cap: monthCap },
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
