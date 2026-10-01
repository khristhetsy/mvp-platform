import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { DepartmentsControls } from "@/components/admin/DepartmentsControls";
import { OutreachAutomationToggle } from "@/components/admin/OutreachAutomationToggle";
import { StageMenuEditor } from "@/components/admin/StageMenuEditor";
import { AiUsageLimitsControls } from "@/components/admin/AiUsageLimitsControls";
import { AiBudgetControls } from "@/components/admin/AiBudgetControls";
import { UploadLimitsControls } from "@/components/admin/UploadLimitsControls";
import { SiteDefaultViewControls } from "@/components/admin/SiteDefaultViewControls";
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
      <SiteDefaultViewControls />
      <OutreachAutomationToggle />
      <DepartmentsControls />
      <AiBudgetControls />
      <AiUsageLimitsControls />
      <UploadLimitsControls />
      <StageMenuEditor />
    </AppShell>
  );
}
