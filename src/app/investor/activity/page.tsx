import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorActivityTimelineSection } from "@/components/InvestorActivityTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorActivityPage() {
  const { profile } = await requireInvestorWorkspaceSession();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Deal Flow"
        title="Recent Activity"
        description="A timeline of your marketplace actions — interests, intros, messages, and more."
      />

      <InvestorFeatureGate>
        <InvestorActivityTimelineSection />
      </InvestorFeatureGate>
    </AppShell>
  );
}
