import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function AdminOperationsBanner({
  pendingReviews,
  openCompliance,
  serviceRoleOk,
}: Readonly<{
  pendingReviews: number;
  openCompliance?: number;
  serviceRoleOk: boolean;
}>) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-white">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Operations control
      </span>
      {pendingReviews > 0 ? (
        <StatusBadge label={`${pendingReviews} review queue`} status="warning" dot />
      ) : (
        <StatusBadge label="Review queue clear" status="success" dot />
      )}
      {openCompliance != null && openCompliance > 0 ? (
        <StatusBadge label={`${openCompliance} compliance`} status="danger" dot />
      ) : null}
      <StatusBadge
        label={serviceRoleOk ? "Service role online" : "Config check"}
        status={serviceRoleOk ? "success" : "warning"}
        dot
      />
      <div className="ml-auto flex flex-wrap gap-2 text-xs">
        <Link href="/admin/reports" className="rounded-md bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20">
          Reports
        </Link>
        <Link href="/admin/spvs" className="rounded-md bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20">
          SPVs
        </Link>
        <Link
          href="/admin/system-health"
          className="rounded-md bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20"
        >
          System
        </Link>
      </div>
    </div>
  );
}
