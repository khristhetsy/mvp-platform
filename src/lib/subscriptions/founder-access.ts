import { NextResponse } from "next/server";
import { requireFeatureAccess, getFounderPathFeature } from "@/lib/subscriptions/access";
import {
  getSubscriptionForProfile,
  ensureSubscriptionForProfile,
  refreshSubscriptionState,
} from "@/lib/subscriptions/get-subscription";
import type { FeatureKey, SubscriptionRecord } from "@/lib/subscriptions/plans";
import { requireRole } from "@/lib/supabase/auth";
import { actingBypass } from "@/lib/admin/acting-central";

export type FounderFeatureAccessContext = {
  profile: Awaited<ReturnType<typeof requireRole>>;
  subscription: SubscriptionRecord;
  featureKey: FeatureKey;
  allowed: boolean;
  reason: string | null;
};

export async function getFounderFeatureAccess(featureKey: FeatureKey): Promise<FounderFeatureAccessContext> {
  const profile = await requireRole(["founder"]);
  let subscription = await getSubscriptionForProfile(profile.id);

  if (!subscription) {
    subscription = await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role });
  }

  subscription = await refreshSubscriptionState(subscription);
  const access = requireFeatureAccess(subscription, featureKey);
  // Staff acting as this founder whose department has the switch on open plan locked features.
  const bypass = !access.allowed && (await actingBypass());

  return {
    profile,
    subscription,
    featureKey,
    allowed: access.allowed || bypass,
    reason: bypass ? null : access.reason,
  };
}

export async function getFounderPathAccess(pathname: string) {
  const featureKey = getFounderPathFeature(pathname);

  if (!featureKey) {
    const profile = await requireRole(["founder"]);
    let subscription = await getSubscriptionForProfile(profile.id);

    if (!subscription) {
      subscription = await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role });
    }

    subscription = await refreshSubscriptionState(subscription);

    return {
      profile,
      subscription,
      featureKey: null as FeatureKey | null,
      allowed: true,
      reason: null,
    };
  }

  return getFounderFeatureAccess(featureKey);
}

/**
 * API counterpart of FounderFeatureGate. Returns a 403 response when the founder's
 * plan does not include the feature, or null when they may proceed. Pages are
 * gated in the UI, but a page gate does nothing for someone calling the route
 * directly, so every paid tool route calls this too. Staff acting on behalf of a
 * founder whose department has the switch on pass, as they do on the page.
 */
export async function founderPlanApiBlock(
  profileId: string,
  featureKey: FeatureKey = "premium_tools",
): Promise<NextResponse | null> {
  let subscription = await getSubscriptionForProfile(profileId);
  if (!subscription) {
    subscription = await ensureSubscriptionForProfile({ profileId, role: "founder" });
  }
  subscription = await refreshSubscriptionState(subscription);
  const access = requireFeatureAccess(subscription, featureKey);
  if (access.allowed) return null;
  if (await actingBypass()) return null;
  return NextResponse.json(
    { error: access.reason ?? "Your plan does not include this feature. Upgrade to continue.", upgrade: true },
    { status: 403 },
  );
}
