import type { SupabaseClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { SubscriptionPlanBadge } from "@/components/SubscriptionPanel";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { maybeNotifyTrialStatus } from "@/lib/notifications/trial-alerts";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { OfferingTypePrompt } from "@/components/founder/OfferingTypePrompt";

type FounderAppShellProps = Readonly<{
  children: React.ReactNode;
  profileName?: string;
  profileSubtitle?: string;
}>;

export async function FounderAppShell({ children, profileName, profileSubtitle }: FounderAppShellProps) {
  const profile = await getCurrentUserProfile();
  let planBadge = null;
  let needsClassification = false;

  if (profile?.role === "founder") {
    const subscription =
      (await getSubscriptionForProfile(profile.id)) ??
      (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
    planBadge = <SubscriptionPlanBadge subscription={subscription} />;
    void maybeNotifyTrialStatus(profile.id, subscription);

    // Prompt existing founders to attest their capital structure (dual-lane §8).
    // Needed only once a company exists and no attestation has been recorded.
    try {
      const admin = createServiceRoleClient() as unknown as SupabaseClient;
      const { data: company } = await admin
        .from("companies")
        .select("offering_type_attested_at")
        .eq("founder_id", profile.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (company && (company as { offering_type_attested_at: string | null }).offering_type_attested_at == null) {
        needsClassification = true;
      }
    } catch {
      // non-blocking — never break the shell over this prompt
    }
  }

  return (
    <AppShell
      role="FOUNDER"
      workspace="founder"
      profileName={profileName ?? profile?.full_name ?? profile?.email ?? "Founder"}
      profileSubtitle={profileSubtitle}
      profileEmail={profile?.email ?? undefined}
      planBadge={planBadge}
    >
      {needsClassification ? <OfferingTypePrompt needsClassification /> : null}
      {children}
    </AppShell>
  );
}
