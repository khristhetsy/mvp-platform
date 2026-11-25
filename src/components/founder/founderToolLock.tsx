import { FounderAppShell } from "@/components/FounderAppShell";
import { SubscriptionLockedPanel } from "@/components/SubscriptionPanel";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";

/**
 * Plan lock for a founder tool page that builds its own shell. Returns the locked
 * page (upgrade panel inside the normal shell) when the founder's plan does not
 * include the paid tools, or null when they may continue. Call it only for a
 * founder, never while staff act on a founder's behalf (that path has its own gate).
 */
export async function founderToolLock(profileName: string, subtitle: string) {
  const access = await getFounderFeatureAccess("premium_tools");
  if (access.allowed) return null;
  return (
    <FounderAppShell profileName={profileName} profileSubtitle={subtitle}>
      <SubscriptionLockedPanel subscription={access.subscription} reason={access.reason} featureKey="premium_tools" />
    </FounderAppShell>
  );
}
