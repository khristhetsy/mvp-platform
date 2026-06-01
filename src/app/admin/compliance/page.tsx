import { AppShell } from "@/components/AppShell";
import { AdminComplianceModuleViews } from "@/components/admin/AdminComplianceModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
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
        actions={
          <a
            href="/admin/audit"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
          >
            Audit center
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
