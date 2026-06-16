import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isTrialExpired } from "@/lib/subscriptions/access";
import {
  PLAN_PRICES,
  TRIAL_DURATION_DAYS,
  type PlanType,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "@/lib/subscriptions/plans";
import type { UserRole } from "@/lib/supabase/types";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

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

  const now = new Date();
  return {
    plan_type: "founder_trial",
    subscription_status: "trialing",
    monthly_price_cents: PLAN_PRICES.founder_trial,
    trial_started_at: now.toISOString(),
    trial_ends_at: addDays(now, TRIAL_DURATION_DAYS).toISOString(),
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

  const { error: insertError } = await admin
    .from("subscriptions")
    .insert({
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
    });

  // Duplicate key = race condition: another request already created it — just fetch it
  if (insertError) {
    if (insertError.code === "23505") {
      const fallback = await getSubscription(input.profileId);
      if (fallback) return refreshSubscriptionState(fallback);
    }
    throw new Error(`Failed to create subscription: ${insertError.message}`);
  }

  const created = await getSubscription(input.profileId);
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
