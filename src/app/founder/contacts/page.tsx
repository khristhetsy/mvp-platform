import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { loadMyContacts } from "@/lib/founder-crm/my-contacts";
import { MyContactsClient } from "./MyContactsClient";

export const dynamic = "force-dynamic";

export default async function FounderMyContactsPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const rows = company ? await loadMyContacts(company.id, profile.id) : [];

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="deploy">
        <FounderFeatureGate featureKey="investor_access">
          <WorkspacePageContainer>
            <PageHeader
              eyebrow="Stage 3 · Marketing"
              title="My contacts"
              description="Your own investors: the ones you imported, the ones iCapOS introduced you to, and the ones you added."
            />
            {company ? <MyContactsClient initialRows={rows} /> : <DealCompanyEmptyState />}
          </WorkspacePageContainer>
        </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
