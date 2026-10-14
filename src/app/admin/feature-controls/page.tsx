import { AppShell } from "@/components/AppShell";
import { FounderSocialControls } from "@/components/admin/FounderSocialControls";
import { getTranslations } from "next-intl/server";
import { DepartmentsControls } from "@/components/admin/DepartmentsControls";
import { OutreachAutomationToggle } from "@/components/admin/OutreachAutomationToggle";
import { StageMenuEditor } from "@/components/admin/StageMenuEditor";
import { AiUsageLimitsControls } from "@/components/admin/AiUsageLimitsControls";
import { AiBudgetControls } from "@/components/admin/AiBudgetControls";
import { UploadLimitsControls } from "@/components/admin/UploadLimitsControls";
import { IrAgentControls } from "@/components/admin/IrAgentControls";
import { SiteDefaultViewControls } from "@/components/admin/SiteDefaultViewControls";
import { requirePermissionPage } from "@/lib/api/permissions";
import { InvestorDirectoryLimitsControls } from "@/components/admin/InvestorDirectoryLimitsControls";
import { loadPlanAllowances, loadSettings } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export default async function AdminFeatureControlsPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_settings");
  // Never let the directory lookup break this page.
  const directory = await Promise.all([loadSettings(), loadPlanAllowances()]).catch(() => null);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("featureControls")}
    >
      {directory ? <InvestorDirectoryLimitsControls settings={directory[0]} allowances={directory[1]} /> : null}
      <SiteDefaultViewControls />
      <OutreachAutomationToggle />
      <DepartmentsControls />
      <AiBudgetControls />
      <AiUsageLimitsControls />
      <UploadLimitsControls />
      <IrAgentControls />
      <StageMenuEditor />
      <FounderSocialControls />
    </AppShell>
  );
}
