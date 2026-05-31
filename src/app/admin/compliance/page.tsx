import { AppShell } from "@/components/AppShell";
import { AdminComplianceModuleViews } from "@/components/admin/AdminComplianceModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadAdminComplianceCenter } from "@/lib/compliance/load-admin-compliance";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const data = await loadAdminComplianceCenter();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <PageHeader
        eyebrow="Risk & compliance"
        title="Compliance & risk review"
        description="Internal institutional controls for readiness risk, outreach compliance, messaging flags, and platform activity. Not legal advice."
        metadata={
          data.scanCreated > 0
            ? `${data.scanCreated} event(s) recorded this session · staff-only internal notes`
            : "Staff-only internal notes · audit trail in compliance_events"
        }
      />

      <AdminComplianceModuleViews
        metrics={data.metrics}
        openQueue={data.openQueue}
        outreach={data.outreach}
        sections={data.sections}
      />
    </AppShell>
  );
}
