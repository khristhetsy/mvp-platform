import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { RoundStructureCalculator } from "@/components/founder/RoundStructureCalculator";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Round structure" };

export default async function RoundStructurePage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile).catch(() => ({ company: null }));

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderFeatureGate featureKey="ai_diligence">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Stage 2 · Preparation"
            title="Round structure"
            description="Test your SAFE, convertible note or priced round before you go to investors, then compare it with published institutional data."
          />
          <RoundStructureCalculator />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
