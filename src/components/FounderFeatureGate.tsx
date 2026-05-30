import type { ReactNode } from "react";
import type { FeatureKey } from "@/lib/subscriptions/plans";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { SubscriptionLockedPanel } from "@/components/SubscriptionPanel";

export async function FounderFeatureGate({
  featureKey,
  children,
}: Readonly<{
  featureKey: FeatureKey;
  children: ReactNode;
}>) {
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
