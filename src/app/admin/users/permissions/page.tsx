import { AppShell } from "@/components/AppShell";
import { UserPermissionsManager } from "@/components/admin/UserPermissionsManager";
import { requireManageUsersPage } from "@/lib/api/permissions";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminUserPermissionsPage() {
  await requireRole(["admin", "analyst"]);
  const { profile } = await requireManageUsersPage();
  const t = await getTranslations("usersAdmin.pages");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("userPermissions")}
    >
      <UserPermissionsManager />
    </AppShell>
  );
}
