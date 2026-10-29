import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isTrialExpired } from "@/lib/subscriptions/access";
import { pastDueState } from "@/lib/billing/past-due";
import {
  PLAN_PRICES,
  type PlanType,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "@/lib/subscriptions/plans";
import type { UserRole } from "@/lib/supabase/types";

function defaultPlanForRole(role: UserRole, _requestedPlan?: PlanType | null): {
  plan_type: PlanType;
  subscription_status: SubscriptionStatus;
  monthly_price_cents: number;
  trial_started_at: string | null;
  trial_ends_at: string | null;
} {
  if (role === "admin" || role === "analyst") {
    return {
      plan_type: "admin_internal",
      subscription_status: "internal",
      monthly_price_cents: 0,
      trial_started_at: null,
      trial_ends_at: null,
    };
  }

  if (role === "investor") {
    return {
      plan_type: "investor_free",
      subscription_status: "free",
      monthly_price_cents: 0,
      trial_started_at: null,
      trial_ends_at: null,
    };
  }

  // Founders who asked for Free (due diligence only, Oct 8, 2026) get it with no
  // checkout. Anyone else lands on Basic awaiting payment. This path only runs
  // when no row exists yet, so it can never downgrade someone.
  const requested = _requestedPlan;
  if (requested === "founder_free") {
    return {
      plan_type: "founder_free",
      subscription_status: "free",
      monthly_price_cents: 0,
      trial_started_at: null,
      trial_ends_at: null,
    };
  }
  const plan: PlanType =
    requested === "founder_professional" || requested === "founder_premium" || requested === "founder_managed_ir"
      ? requested : "founder_basic";

  return {
    plan_type: plan,
    subscription_status: "pending_payment",
    monthly_price_cents: PLAN_PRICES[plan],
    trial_started_at: null,
    trial_ends_at: null,
  };
}

export async function getSubscription(profileId: string): Promise<SubscriptionRecord | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("subscriptions").select("*").eq("profile_id", profileId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load subscription: ${error.message}`);
  }

  return (data as SubscriptionRecord | null) ?? null;
}

export async function getUserPlan(profileId: string) {
  const subscription = await getSubscription(profileId);
  return subscription?.plan_type ?? null;
}

/**
 * The plan to use for DISTRIBUTION limits (outreach, introductions, investor
 * sends). Same as getUserPlan, except a founder whose failed renewal payment ran
 * past the grace period is treated as Free, so distribution stops while every
 * tool stays on. Use this wherever founderEntitlements() is fed a plan.
 */
export async function getDistributionPlan(profileId: string) {
  const subscription = await getSubscription(profileId);
  if (!subscription) return null;
  return pastDueState(subscription) === "lapsed" ? ("founder_free" as const) : subscription.plan_type;
}

export async function refreshSubscriptionState(subscription: SubscriptionRecord): Promise<SubscriptionRecord> {
  if (subscription.plan_type !== "founder_trial") {
    return subscription;
  }

  if (!isTrialExpired(subscription)) {
    return subscription;
  }

  if (subscription.subscription_status === "expired") {
    return subscription;
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("subscriptions")
    .update({
      subscription_status: "expired",
      updated_at: now,
    })
    .eq("id", subscription.id)
    .select("*")
    .single();

  if (error || !data) {
    return { ...subscription, subscription_status: "expired", updated_at: now };
  }

  return data as SubscriptionRecord;
}

export async function ensureSubscriptionForProfile(input: {
  profileId: string;
  role: UserRole;
  requestedPlan?: PlanType | null;
}): Promise<SubscriptionRecord> {
  const existing = await getSubscription(input.profileId);

  if (existing) {
    return refreshSubscriptionState(existing);
  }

  const defaults = defaultPlanForRole(input.role, input.requestedPlan);
  const now = new Date().toISOString();
  const admin = createServiceRoleClient();

  // Upsert with ignoreDuplicates: ensureSubscriptionForProfile runs on every founder
  // page render, so two requests can race on the same new profile. A conflict is
  // not an error here, the other request already created the row.
  const { data: inserted, error: insertError } = await admin
    .from("subscriptions")
    .upsert(
      {
        profile_id: input.profileId,
        role: input.role,
        plan_type: defaults.plan_type,
        subscription_status: defaults.subscription_status,
        trial_started_at: defaults.trial_started_at,
        trial_ends_at: defaults.trial_ends_at,
        current_period_start: now,
        current_period_end: defaults.trial_ends_at,
        monthly_price_cents: defaults.monthly_price_cents,
        currency: "USD",
        // New Free rows are never grandfathered: they get due diligence and the
        // CRR only (access.ts reads this flag).
        is_grandfathered: false,
      },
      { onConflict: "profile_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();

  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to create subscription: ${insertError.message}`);
  }

  // Use the row the upsert returned. A separate read straight after the write has
  // come back empty in production and crashed /founder/onboarding for new founders.
  // On a conflict (ignoreDuplicates) no row comes back, so fall through to the read.
  let created = (inserted as SubscriptionRecord | null) ?? (await getSubscription(input.profileId));
  for (let attempt = 0; !created && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    created = await getSubscription(input.profileId);
  }
  if (!created) {
    throw new Error("Failed to create subscription: record not found after insert.");
  }

  return refreshSubscriptionState(created);
}

export async function getSubscriptionForProfile(profileId: string) {
  const subscription = await getSubscription(profileId);

  if (!subscription) {
    return null;
  }

  return refreshSubscriptionState(subscription);
}

export async function listSubscriptionsByProfileIds(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, SubscriptionRecord>();
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("subscriptions").select("*").in("profile_id", profileIds);

  if (error) {
    throw new Error(`Failed to load subscriptions: ${error.message}`);
  }

  const map = new Map<string, SubscriptionRecord>();

  for (const row of (data ?? []) as SubscriptionRecord[]) {
    map.set(row.profile_id, row);
  }

  return map;
}
