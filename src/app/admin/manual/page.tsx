import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { AdminManualClient } from "@/components/admin/AdminManualClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { requireRole } from "@/lib/supabase/auth";
import { visibleSops } from "@/lib/admin-sop/retrieve";

export const dynamic = "force-dynamic";

export default async function AdminManualPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin", "analyst"]);
  // Everyone in admin/analyst may read the manual; content is filtered per
  // permission. view_admin_dashboard is the lightest staff-wide gate.
  const { profile, effective } = await requirePermissionPage("view_admin_dashboard");

  const entries = visibleSops({
    permissions: effective.permissions,
    isSuperAdmin: effective.isSuperAdmin,
  });

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("operationsManual")}
    >
      <AdminManualClient entries={entries} />
    </AppShell>
  );
}
