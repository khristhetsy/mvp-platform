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
