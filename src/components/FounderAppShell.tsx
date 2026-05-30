import { AppShell } from "@/components/AppShell";
import { SubscriptionPlanBadge } from "@/components/SubscriptionPanel";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { maybeNotifyTrialStatus } from "@/lib/notifications/trial-alerts";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";

type FounderAppShellProps = Readonly<{
  children: React.ReactNode;
  profileName?: string;
  profileSubtitle?: string;
}>;

export async function FounderAppShell({ children, profileName, profileSubtitle }: FounderAppShellProps) {
  const profile = await getCurrentUserProfile();
  let planBadge = null;

  if (profile?.role === "founder") {
    const subscription =
      (await getSubscriptionForProfile(profile.id)) ??
      (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
    planBadge = <SubscriptionPlanBadge subscription={subscription} />;
    void maybeNotifyTrialStatus(profile.id, subscription);
  }

  return (
    <AppShell
      role="FOUNDER"
      workspace="founder"
      profileName={profileName ?? profile?.full_name ?? profile?.email ?? "Founder"}
      profileSubtitle={profileSubtitle}
      planBadge={planBadge}
    >
      {children}
    </AppShell>
  );
}
