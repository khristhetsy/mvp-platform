import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllOrganizations } from "@/lib/organizations/organizations";
import { AdminAccountsClient } from "@/components/admin/AdminAccountsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  // Any admin/analyst staff (incl. Sales) can view AND create demo/internal
  // accounts here — no per-person permission grant required.
  const profile = await requireRole(["admin", "analyst"]);
  const canManage = true;
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
        <AdminAccountsClient initialOrgs={orgs} canManage={canManage} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
