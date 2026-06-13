import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvestorTasksPageClient } from "@/components/investor/InvestorTasksPageClient";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorTasksPage() {
  const { profile } = await requireInvestorWorkspaceSession();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Investor workspace"
        title="My Tasks"
        description="Track follow-ups, due diligence, and deal pipeline to-dos."
      />
      <InvestorTasksPageClient />
    </AppShell>
  );
}
