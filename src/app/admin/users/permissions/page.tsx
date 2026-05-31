import { AppShell } from "@/components/AppShell";
import { UserPermissionsManager } from "@/components/admin/UserPermissionsManager";
import { requireManageUsersPage } from "@/lib/api/permissions";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminUserPermissionsPage() {
  await requireRole(["admin", "analyst"]);
  const { profile } = await requireManageUsersPage();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="User Permissions"
    >
      <UserPermissionsManager />
    </AppShell>
  );
}
