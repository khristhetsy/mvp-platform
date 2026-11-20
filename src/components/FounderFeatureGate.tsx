import type { ReactNode } from "react";
import type { FeatureKey } from "@/lib/subscriptions/plans";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { SubscriptionLockedPanel } from "@/components/SubscriptionPanel";

export async function FounderFeatureGate({
  featureKey,
  children,
  bypass = false,
}: Readonly<{
  featureKey: FeatureKey;
  children: ReactNode;
  /** Invitation only courses: the invitation is the access, so the plan feature does not apply. */
  bypass?: boolean;
}>) {
  if (bypass) return children;
  const access = await getFounderFeatureAccess(featureKey);

  if (!access.allowed) {
    return (
      <SubscriptionLockedPanel
        subscription={access.subscription}
        reason={access.reason}
        featureKey={featureKey}
      />
    );
  }

  return children;
}
