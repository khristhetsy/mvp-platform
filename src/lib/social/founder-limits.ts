/**
 * Founder social media limits and usage (server only).
 *
 * Limits live in founder_social_limits so admin can change them without a deploy.
 * The fallback below applies only if that table can't be read, and it is the safe
 * direction: no access. Enforcement happens in the founder API routes, never in
 * the UI counter.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSubscription } from "@/lib/subscriptions/get-subscription";
import { cycleBounds, limitState, remainingPosts, type SocialUsage } from "@/lib/social/usage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type FounderSocialLimit = { planType: string; enabled: boolean; postsPerMonth: number | null };

export const FOUNDER_SOCIAL_PLANS = ["founder_free", "founder_basic", "founder_professional", "founder_premium"] as const;

/** The master switch is one reserved row; every plan row is ignored while it is off. */
export const MASTER_ROW = "master";

type LimitRow = { plan_type: string; enabled: boolean; posts_per_month: number | null };

export async function listFounderSocialLimits(): Promise<{ master: boolean; plans: FounderSocialLimit[] }> {
  const { data, error } = await db().from("founder_social_limits").select("plan_type, enabled, posts_per_month");
  if (error) throw new Error(`Failed to load founder social limits: ${error.message}`);
  const rows = (data ?? []) as LimitRow[];
  const master = rows.find((r) => r.plan_type === MASTER_ROW);
  return {
    master: master ? Boolean(master.enabled) : true,
    plans: rows.filter((r) => r.plan_type !== MASTER_ROW).map((r) => ({
      planType: r.plan_type, enabled: Boolean(r.enabled), postsPerMonth: r.posts_per_month ?? null,
    })),
  };
}

export async function getFounderSocialLimit(planType: string | null | undefined): Promise<FounderSocialLimit> {
  const off: FounderSocialLimit = { planType: planType ?? "none", enabled: false, postsPerMonth: 0 };
  if (!planType) return off;
  const { data, error } = await db().from("founder_social_limits").select("plan_type, enabled, posts_per_month").in("plan_type", [planType, MASTER_ROW]);
  if (error || !data) return off;
  const rows = data as LimitRow[];
  const master = rows.find((r) => r.plan_type === MASTER_ROW);
  const r = rows.find((x) => x.plan_type === planType);
  if (!r || (master && !master.enabled)) return off;
  return { planType: r.plan_type, enabled: Boolean(r.enabled), postsPerMonth: r.posts_per_month ?? null };
}

/** Posts that count toward the limit: scheduled or published, created this cycle.
 *  One post sent to several networks is one social_posts row, so it counts once.
 *  Held drafts (held_until set) and plain drafts do not count. */
export async function countFounderPostsInCycle(ownerId: string, cycleStart: Date, resetAt: Date): Promise<number> {
  const { count, error } = await db().from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("owner_profile_id", ownerId)
    .in("status", ["scheduled", "published"])
    .is("held_until", null)
    .is("deleted_at", null)
    .gte("created_at", cycleStart.toISOString())
    .lt("created_at", resetAt.toISOString());
  if (error) throw new Error(`Failed to count founder posts: ${error.message}`);
  return count ?? 0;
}

export async function getFounderSocialUsage(profileId: string, now: Date = new Date()): Promise<SocialUsage> {
  const [sub, profile] = await Promise.all([
    getSubscription(profileId),
    db().from("profiles").select("created_at").eq("id", profileId).maybeSingle(),
  ]);
  const signupAt = new Date((profile.data as { created_at?: string } | null)?.created_at ?? now.toISOString());
  const { start, resetAt } = cycleBounds(signupAt, now);
  const planType = sub?.plan_type ?? null;
  const limit = await getFounderSocialLimit(planType);
  const used = limit.enabled ? await countFounderPostsInCycle(profileId, start, resetAt) : 0;
  return {
    planType,
    enabled: limit.enabled,
    limit: limit.postsPerMonth,
    used,
    remaining: remainingPosts(limit.postsPerMonth, used),
    state: limitState(limit.enabled, limit.postsPerMonth, used),
    cycleStart: start.toISOString(),
    resetAt: resetAt.toISOString(),
  };
}

/** Rows for the admin usage list: every founder with a social plan and their cycle count. */
export async function listFounderSocialUsage(): Promise<Array<{ profileId: string; name: string; usage: SocialUsage }>> {
  const limits = await listFounderSocialLimits();
  const enabledPlans = limits.master ? limits.plans.filter((l) => l.enabled).map((l) => l.planType) : [];
  if (enabledPlans.length === 0) return [];
  const { data: subs } = await db().from("subscriptions").select("profile_id").in("plan_type", enabledPlans);
  const ids = ((subs ?? []) as Array<{ profile_id: string }>).map((s) => s.profile_id);
  if (ids.length === 0) return [];
  const { data: profs } = await db().from("profiles").select("id, full_name, email").in("id", ids);
  const names = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name ?? p.email ?? "Founder"]));
  const rows = await Promise.all(ids.map(async (id) => ({ profileId: id, name: names.get(id) ?? "Founder", usage: await getFounderSocialUsage(id) })));
  return rows.sort((a, b) => (b.usage.used) - (a.usage.used));
}
