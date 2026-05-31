import { WorkspacePanel } from "@/components/WorkspacePanel";
import { investorApprovalStatusLabel } from "@/lib/investor/access";
import { CONTACT_PREFERENCES, INVESTOR_TYPES, type InvestorProfileRecord } from "@/lib/investor/types";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function labelFromOptions(value: string | null, options: ReadonlyArray<{ value: string; label: string }>) {
  if (!value) return "—";
  return options.find((row) => row.value === value)?.label ?? value;
}

export function InvestorProfilePanel({
  investor,
}: Readonly<{
  investor: InvestorProfileRecord & {
    profiles?: { full_name?: string | null; email?: string | null } | null;
  };
}>) {
  return (
    <WorkspacePanel title="Profile summary" subtitle="Source: investor_profiles">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Firm</dt>
          <dd className="font-medium text-slate-900">{investor.firm_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="font-medium text-slate-900">{labelFromOptions(investor.investor_type, INVESTOR_TYPES)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Contact preference</dt>
          <dd className="font-medium text-slate-900">
            {labelFromOptions(investor.contact_preference, CONTACT_PREFERENCES)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Accreditation</dt>
          <dd className="font-medium text-slate-900">{investor.accredited_status ? "Self-attested yes" : "Not attested"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Approval status</dt>
          <dd className="font-medium text-slate-900">{investorApprovalStatusLabel(investor.approval_status)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">{formatDate(investor.submitted_at)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Approved</dt>
          <dd className="font-medium text-slate-900">{formatDate(investor.approved_at)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Investment thesis</dt>
          <dd className="mt-1 leading-6 text-slate-800">{investor.investment_thesis ?? "—"}</dd>
        </div>
        {investor.profiles?.email ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Contact email</dt>
            <dd className="font-medium text-slate-900">{investor.profiles.email}</dd>
          </div>
        ) : null}
      </dl>
    </WorkspacePanel>
  );
}
