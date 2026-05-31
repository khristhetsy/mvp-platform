import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";

export function SpvClosingPanel({
  closing,
  spvId,
  companyId,
}: Readonly<{
  closing: AdminSpvWorkspaceData["closing"];
  spvId: string;
  companyId: string;
}>) {
  return (
    <WorkspacePanel
      title="Closing review"
      subtitle="Operational closing readiness — not legal execution"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Review status</p>
          <p className="mt-1 font-semibold text-slate-900">{closing.operationalCloseState}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Closing readiness</p>
          <p className="mt-1 font-semibold text-slate-900">{closing.summary.readinessPct}%</p>
        </div>
      </div>

      {closing.targetOverride ? (
        <p className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm text-violet-900">
          Admin target override is active for indicative target criteria.
        </p>
      ) : null}

      {closing.review?.reviewed_at ? (
        <p className="mt-3 text-xs text-slate-500">
          Last reviewed {new Date(closing.review.reviewed_at).toLocaleString("en-US", { timeZone: "UTC" })}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {closing.summary.criteria.map((row) => (
          <li key={row.key} className="flex items-start gap-2 text-sm">
            <StatusBadge label={row.met ? "Met" : "Open"} status={row.met ? "success" : "warning"} />
            <span className="text-slate-800">{row.label}</span>
          </li>
        ))}
      </ul>

      {!closing.review ? (
        <EmptyState
          title="Closing review not initialized"
          description="Run Refresh readiness in SPV management to initialize closing review tracking."
        />
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Manage closing actions in SPV management below ·{" "}
        <Link href={`/admin/spvs/${spvId}#spv-management`} className="font-medium text-indigo-600 hover:text-indigo-800">
          Jump to management panel
        </Link>
      </p>
    </WorkspacePanel>
  );
}
