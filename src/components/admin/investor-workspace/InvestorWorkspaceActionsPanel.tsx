import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildInvestorFilteredHref, buildInvestorReportHref } from "@/lib/admin/investor-workspace-types";

const ACTION_LINKS = [
  {
    title: "Investor activity export",
    description: "Interests, CRM activity, and engagement aggregates.",
    href: (profileId: string) => buildInvestorReportHref(profileId, "investor_activity"),
  },
  {
    title: "SPV readiness (filtered)",
    description: "SPV opportunities where this investor participates.",
    href: (profileId: string) => buildInvestorFilteredHref("/admin/spvs", profileId),
  },
  {
    title: "CRM (filtered)",
    description: "Pipeline activity scoped to this investor.",
    href: (profileId: string) => buildInvestorFilteredHref("/admin/crm", profileId),
  },
  {
    title: "Messages (filtered)",
    description: "Message activity filter in CRM — no message bodies exposed here.",
    href: (profileId: string) => buildInvestorFilteredHref("/admin/crm", profileId, { activity: "message_sent" }),
  },
] as const;

export function InvestorWorkspaceActionsPanel({
  profileId,
  investorName,
}: Readonly<{ profileId: string; investorName: string }>) {
  return (
    <WorkspacePanel title="Reports & quick actions" subtitle={`Pre-filtered for ${investorName}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ACTION_LINKS.map((link) => (
          <Link
            key={link.title}
            href={link.href(profileId)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
          >
            <p className="font-semibold text-slate-900">{link.title}</p>
            <p className="mt-1 text-xs text-slate-600">{link.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Source: /admin/reports, /admin/crm, /admin/spvs · Investor filter applied via URL parameters
      </p>
    </WorkspacePanel>
  );
}
