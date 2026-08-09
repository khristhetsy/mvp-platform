import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllOrganizations } from "@/lib/organizations/organizations";
import { AdminAccountsClient } from "@/components/admin/AdminAccountsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const { profile } = await requirePermissionPage("manage_accounts");
  const orgs = await listAllOrganizations(createServiceRoleClient()).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Admin account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Accounts"
          title="Account registry"
          description="Every account — Founder and Deal Company — with live billing status. Create demo or internal accounts directly (comped, email dispatch off)."
        />
        <AdminAccountsClient initialOrgs={orgs} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
