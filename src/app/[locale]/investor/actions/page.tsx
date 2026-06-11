import { AppShell } from "@/components/AppShell";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorActionsPage() {
  const { profile } = await requireInvestorWorkspaceSession();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <ActionCenterPage
        role="investor"
        title="Investor Action Center"
        description="Profile, approvals, SPV requirements, intros, meetings, and opportunity follow-ups."
      />
    </AppShell>
  );
}
