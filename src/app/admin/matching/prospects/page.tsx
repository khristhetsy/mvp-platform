import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { ProspectInvestorsManager } from "@/components/admin/matching/ProspectInvestorsManager";
import { loadProspectInvestors } from "@/lib/matching/prospect-investors";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminProspectInvestorsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const prospects = await loadProspectInvestors();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Prospect investors"
          description="Internal, unverified investor records used to seed the matching engine. These are not platform members and are visible to staff only — use them to test and enrich matches against real founders."
        />

        <ProspectInvestorsManager initialProspects={prospects} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
