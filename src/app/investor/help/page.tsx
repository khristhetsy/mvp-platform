import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorHelpClient } from "@/components/investor/InvestorHelpClient";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { getAllInvestorStageGuides } from "@/lib/investor/stage-guides";

export const dynamic = "force-dynamic";
export const metadata = { title: "How iCapOS works" };

export default async function InvestorHelpPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle="Investor account">
      <WorkspacePageContainer>
        <InvestorHelpClient guides={getAllInvestorStageGuides()} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
