import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canUser } from "@/lib/rbac/effective-permissions";
import { listAllOrganizations } from "@/lib/organizations/organizations";
import { AdminAccountsClient } from "@/components/admin/AdminAccountsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  // Any staff can VIEW the registry; creating/comping is gated on the
  // manage_accounts permission (super admins have it automatically; a super admin
  // grants it to e.g. a salesperson in Admin → User Permissions).
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = await createServerSupabaseClient();
  const canManage = await canUser(supabase, profile.id, "manage_accounts", profile);
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
