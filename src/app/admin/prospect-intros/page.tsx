import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listProspectIntroRequests } from "@/lib/matching/prospect-intros";
import { ProspectIntrosClient } from "@/components/admin/ProspectIntrosClient";

export const dynamic = "force-dynamic";

export default async function AdminProspectIntrosPage() {
  const { profile } = await requirePermissionPage("manage_matching");
  const requests = await listProspectIntroRequests();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Brokered Intros">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Brokered intros"
          description="Founders requesting introductions to CRM prospect investors from the Matching Center. Broker the intro, then mark it contacted."
        />
        <div className="mt-6">
          <ProspectIntrosClient initial={requests} />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
