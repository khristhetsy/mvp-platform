import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvitationsClient } from "@/components/admin-events/InvitationsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitations" };

/** Event Hub, Invitations: campaigns that invite founders, investors and advisors to upcoming events. */
export default async function InvitationsPage() {
  const { profile } = await requirePermissionPage("manage_events");
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Invitations">
      <WorkspacePageContainer>
        <InvitationsClient />
      </WorkspacePageContainer>
    </AppShell>
  );
}
