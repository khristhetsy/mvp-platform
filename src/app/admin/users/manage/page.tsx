import { AppShell } from "@/components/AppShell";
import { UserManagementClient } from "@/components/admin/UserManagementClient";
import { requireManageUsersPage } from "@/lib/api/permissions";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminUserManagePage() {
  await requireRole(["admin", "analyst"]);
  const { profile } = await requireManageUsersPage();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="User Management"
    >
      <UserManagementClient />
    </AppShell>
  );
}
