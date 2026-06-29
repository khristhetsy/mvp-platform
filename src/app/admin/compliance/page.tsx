import { AppShell } from "@/components/AppShell";
import { AdminComplianceModuleViews } from "@/components/admin/AdminComplianceModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { loadAdminComplianceCenter } from "@/lib/compliance/load-admin-compliance";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const data = await loadAdminComplianceCenter();
  const t = await getTranslations("complianceAdmin.page");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("desc")}
        metadata={
          data.scanCreated > 0
            ? t("recorded", { count: data.scanCreated })
            : t("auditNote")
        }
        actions={
          <a
            href="/admin/audit"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
          >
            {t("auditCenter")}
          </a>
        }
      />

      <div className="mb-6">
        <DraftEmailPanel role={profile.role} defaultTemplate="compliance_followup" />
      </div>

      <AdminComplianceModuleViews
        metrics={data.metrics}
        openQueue={data.openQueue}
        outreach={data.outreach}
        sections={data.sections}
      />
    </AppShell>
  );
}
