import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { DepartmentsControls } from "@/components/admin/DepartmentsControls";
import { requirePermissionPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function AdminFeatureControlsPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_settings");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("featureControls")}
    >
      <DepartmentsControls />
    </AppShell>
  );
}
