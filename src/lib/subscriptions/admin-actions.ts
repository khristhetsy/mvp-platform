import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";

export type CompDuration = "30d" | "6m" | "1y" | "indefinite";

export type AdminSubscriptionView = {
  exists: boolean;
  status: string | null;
  planType: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SELECT = "subscription_status, plan_type, trial_ends_at, current_period_end";

type Row = {
  subscription_status: string | null;
  plan_type: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

function db(): SupabaseClient<Database> {
  return createServiceRoleClient();
}

function toView(row: Row | null): AdminSubscriptionView {
  if (!row) return { exists: false, status: null, planType: null, trialEndsAt: null, currentPeriodEnd: null };
  return {
    exists: true,
    status: row.subscription_status,
    planType: row.plan_type,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function loadAdminSubscription(profileId: string): Promise<AdminSubscriptionView> {
  const { data } = await db().from("subscriptions").select(SELECT).eq("profile_id", profileId).maybeSingle();
  return toView(data as Row | null);
}

/** Admin/analyst: extend the trial by a fixed number of days. */
export async function extendTrial(profileId: string, days: number, actorId: string): Promise<AdminSubscriptionView> {
  const client = db();
  const endsIso = new Date(Date.now() + days * DAY_MS).toISOString();
  const { data } = await client
    .from("subscriptions")
    .update({
      subscription_status: "trialing",
      trial_ends_at: endsIso,
      current_period_end: endsIso,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .select(SELECT)
    .maybeSingle();

  await writeAuditLog(client, {
    userId: actorId,
    action: "subscription.extend_trial",
    entityType: "subscription",
    entityId: profileId,
    metadata: { days, trial_ends_at: endsIso },
  });

  return toView(data as Row | null);
}

function compEnd(duration: CompDuration): string {
  const now = Date.now();
  const ms =
    duration === "30d" ? 30 * DAY_MS
      : duration === "6m" ? 182 * DAY_MS
        : duration === "1y" ? 365 * DAY_MS
          : 100 * 365 * DAY_MS; // "indefinite" ≈ 100 years
  return new Date(now + ms).toISOString();
}

/** Super admin only: comp a full plan (no trial expiry) for the chosen duration. */
export async function compPlan(profileId: string, duration: CompDuration, actorId: string): Promise<AdminSubscriptionView> {
  const client = db();
  const endsIso = compEnd(duration);
  const { data } = await client
    .from("subscriptions")
    .update({
      subscription_status: "active",
      plan_type: "founder_professional",
      trial_ends_at: null,
      current_period_end: endsIso,
      monthly_price_cents: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .select(SELECT)
    .maybeSingle();

  await writeAuditLog(client, {
    userId: actorId,
    action: "subscription.comp_plan",
    entityType: "subscription",
    entityId: profileId,
    metadata: { duration, plan: "founder_professional", current_period_end: endsIso },
  });

  return toView(data as Row | null);
}
