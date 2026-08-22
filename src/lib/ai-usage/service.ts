import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PlanType } from "@/lib/subscriptions/plans";
import {
  defaultLimits,
  planBucket,
  type LimitPlan,
  type PlanLimit,
  type UsagePeriod,
} from "@/lib/ai-usage";

type Admin = ReturnType<typeof createServiceRoleClient>;

// ai_usage_* aren't in the generated types yet — cast to a raw client.
function raw(admin: Admin): SupabaseClient {
  return admin as unknown as SupabaseClient;
}

function windowDays(period: UsagePeriod): number {
  return period === "month" ? 30 : 7;
}

/** Merged limits (admin overrides on top of code defaults) for a feature. */
export async function getFeatureLimits(
  feature: string,
  admin: Admin = createServiceRoleClient(),
): Promise<Record<LimitPlan, PlanLimit>> {
  const merged: Record<LimitPlan, PlanLimit> = { ...defaultLimits(feature) };
  try {
    const { data } = await raw(admin)
      .from("ai_usage_limits")
      .select("plan, max_runs, period")
      .eq("feature", feature);
    for (const r of (data ?? []) as Array<{ plan: string; max_runs: number | null; period: string }>) {
      if (r.plan in merged) {
        merged[r.plan as LimitPlan] = {
          maxRuns: r.max_runs ?? null,
          period: r.period === "month" ? "month" : "week",
        };
      }
    }
  } catch {
    // table missing / error → code defaults
  }
  return merged;
}

/** Persist admin-set caps for a feature (one row per plan). */
export async function saveFeatureLimits(
  feature: string,
  limits: Record<LimitPlan, PlanLimit>,
  admin: Admin = createServiceRoleClient(),
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const rows = (Object.keys(limits) as LimitPlan[]).map((plan) => ({
    feature,
    plan,
    max_runs: limits[plan].maxRuns,
    period: limits[plan].period,
    updated_at: now,
  }));
  const { error } = await raw(admin).from("ai_usage_limits").upsert(rows, { onConflict: "feature,plan" });
  return { error: error?.message ?? null };
}

export type UsageCheck = {
  allowed: boolean;
  unlimited: boolean;
  used: number;
  maxRuns: number | null;
  period: UsagePeriod;
  /** ISO time the oldest run ages out of the window (only when blocked). */
  resetAt: string | null;
};

/** Does this user have a run left for `feature`? Does NOT consume — call recordUsage on success. */
export async function checkUsage(opts: {
  profileId: string;
  plan: PlanType | null | undefined;
  feature: string;
  admin?: Admin;
}): Promise<UsageCheck> {
  const admin = opts.admin ?? createServiceRoleClient();
  const limits = await getFeatureLimits(opts.feature, admin);
  const limit = limits[planBucket(opts.plan)];

  if (limit.maxRuns == null) {
    return { allowed: true, unlimited: true, used: 0, maxRuns: null, period: limit.period, resetAt: null };
  }

  const since = new Date(Date.now() - windowDays(limit.period) * 86_400_000).toISOString();
  const { data } = await raw(admin)
    .from("ai_usage_events")
    .select("created_at")
    .eq("profile_id", opts.profileId)
    .eq("feature", opts.feature)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  const events = (data ?? []) as Array<{ created_at: string }>;
  const used = events.length;

  if (used < limit.maxRuns) {
    return { allowed: true, unlimited: false, used, maxRuns: limit.maxRuns, period: limit.period, resetAt: null };
  }

  // Over the cap. The next free slot opens when the oldest counted run ages out.
  const oldest = events[0]?.created_at ? new Date(events[0].created_at) : new Date();
  const resetAt = new Date(oldest.getTime() + windowDays(limit.period) * 86_400_000).toISOString();
  return { allowed: false, unlimited: false, used, maxRuns: limit.maxRuns, period: limit.period, resetAt };
}

/** Record one successful paid run. Best-effort. */
export async function recordUsage(opts: { profileId: string; feature: string; admin?: Admin }): Promise<void> {
  const admin = opts.admin ?? createServiceRoleClient();
  try {
    await raw(admin).from("ai_usage_events").insert({ profile_id: opts.profileId, feature: opts.feature });
  } catch {
    // non-fatal — never block a completed analysis on a logging failure
  }
}
