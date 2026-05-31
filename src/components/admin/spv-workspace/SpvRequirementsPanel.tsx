import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";

export function SpvRequirementsPanel({
  requirements,
  spvId,
  companyId,
}: Readonly<{
  requirements: AdminSpvWorkspaceData["requirements"];
  spvId: string;
  companyId: string;
}>) {
  return (
    <WorkspacePanel title="Investor requirements" subtitle="Status counts — no uploaded file content">
      <MetricGrid>
        <MetricCard label="Pending" value={String(requirements.pending)} detail="Awaiting upload" accent="slate" />
        <MetricCard label="Uploaded" value={String(requirements.uploaded)} detail="Awaiting review" accent="blue" />
        <MetricCard label="Under review" value={String(requirements.underReview)} detail="Staff review" accent="violet" />
        <MetricCard label="Rejected" value={String(requirements.rejected)} detail="Needs resubmission" accent="indigo" />
      </MetricGrid>

      <p className="mt-3 text-sm text-slate-700">
        Approved / waived: <strong>{requirements.approved}</strong>
      </p>

      {requirements.nextAction ? (
        <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">{requirements.nextAction}</p>
      ) : null}

      {requirements.latestUpdates.length === 0 ? (
        <EmptyState title="No requirements" description="Requirements appear when investor participations are seeded." />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {requirements.latestUpdates.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{row.title}</p>
                <StatusBadge label={row.status.replace(/_/g, " ")} status="neutral" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {row.investorName} · {row.category.replace(/_/g, " ")} ·{" "}
                {new Date(row.updatedAt).toLocaleString("en-US", { timeZone: "UTC" })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Source: spv_participation_requirements ·{" "}
        <Link
          href={`/admin/spvs?queue=investor_documents&spv=${spvId}`}
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          Open investor documents queue
        </Link>
        {" · "}
        <Link href={`/admin/spvs/${spvId}#spv-management`} className="font-medium text-indigo-600 hover:text-indigo-800">
          Review in SPV management
        </Link>
      </p>
    </WorkspacePanel>
  );
}
