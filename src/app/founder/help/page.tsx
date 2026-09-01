import { FounderAppShell } from "@/components/FounderAppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getAllStageGuides } from "@/lib/founder/stage-guides";
import { HelpCenterClient } from "@/components/founder/HelpCenterClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "How iCapOS works" };

export default async function FounderHelpPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const guides = getAllStageGuides();

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <HelpCenterClient guides={guides} />
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
