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
      <div id="site-default-view" className="scroll-mt-24"><SiteDefaultViewControls /></div>
      <div id="outreach-automation" className="scroll-mt-24"><OutreachAutomationToggle /></div>
      <div id="departments" className="scroll-mt-24"><DepartmentsControls /></div>
      <div id="ai-budget" className="scroll-mt-24"><AiBudgetControls /></div>
      <div id="ai-usage-limits" className="scroll-mt-24"><AiUsageLimitsControls /></div>
      <div id="upload-limits" className="scroll-mt-24"><UploadLimitsControls /></div>
      <div id="ir-agent" className="scroll-mt-24"><IrAgentControls /></div>
      <div id="stage-menu" className="scroll-mt-24"><StageMenuEditor /></div>
      <div id="founder-social" className="scroll-mt-24"><FounderSocialControls /></div>
    </AppShell>
  );
}
