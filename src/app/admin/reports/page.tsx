import Link from "next/link";
import { AdminReportsPanel } from "@/components/AdminReportsPanel";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadAdminReportFilterOptions } from "@/lib/reports/admin-reports";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const REPORT_SECTIONS = [
  {
    title: "Compliance report",
    description: "Compliance events with severity, status, and review metadata.",
    reportType: "compliance",
  },
  {
    title: "Founder readiness report",
    description: "Onboarding progress, diligence scores, remediation tasks, and learning.",
    reportType: "founder_readiness",
  },
  {
    title: "Investor activity report",
    description: "Interests, CRM activity events, and investor approval status.",
    reportType: "investor_activity",
  },
  {
    title: "Outreach activity report",
    description: "Campaigns, social drafts, targets, and outreach message metadata.",
    reportType: "outreach_activity",
  },
  {
    title: "Messaging & meeting report",
    description: "Threads, scheduled meetings, message metadata, and notifications.",
    reportType: "messaging_meetings",
  },
  {
    title: "Subscription & upgrade report",
    description: "Subscription plans, billing status, and upgrade requests.",
    reportType: "subscription_upgrade",
  },
  {
    title: "Due Diligence Report",
    description:
      "Review company readiness, diligence findings, document status, remediation tasks, admin reviews, and investor-readiness indicators.",
    reportType: "due_diligence",
  },
] as const;

function toFilterOption(row: {
  id: string;
  company_name?: string;
  full_name?: string | null;
  email?: string | null;
}) {
  const name = row.company_name ?? row.full_name ?? row.email ?? row.id.slice(0, 8);
  return { id: row.id, label: name };
}

export default async function AdminReportsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();
  const options = await loadAdminReportFilterOptions(admin);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Audit export &amp; reporting</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Generate internal JSON or CSV summaries from existing platform data for compliance, diligence, and
          operational oversight. Not legal filings, tax reports, or external compliance integrations.
        </p>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_SECTIONS.map((section) => (
          <WorkspacePanel key={section.reportType} title={section.title} subtitle={section.description}>
            <p className="text-xs text-slate-500">
              Report type: <span className="font-mono text-slate-700">{section.reportType}</span>
            </p>
          </WorkspacePanel>
        ))}
      </section>

      <AdminReportsPanel
        companies={options.companies.map(toFilterOption)}
        founders={options.founders.map(toFilterOption)}
        investors={options.investors.map(toFilterOption)}
      />

      <p className="mt-8 text-sm text-slate-600">
        Each export writes an{" "}
        <span className="font-medium text-slate-800">audit_logs</span> entry with report type, filters, and
        generator.{" "}
        <Link href="/admin/compliance" className="font-semibold text-indigo-700">
          Compliance center
        </Link>{" "}
        ·{" "}
        <Link href="/admin/analytics" className="font-semibold text-indigo-700">
          Analytics
        </Link>
      </p>
    </AppShell>
  );
}
