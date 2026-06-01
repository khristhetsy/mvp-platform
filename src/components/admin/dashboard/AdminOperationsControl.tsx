import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSection } from "@/components/ui/workspace-layout";
import { drilldownFocusClass, drilldownHoverClass } from "@/components/ui/drilldown";
import type { AdminQueueSummaryItem } from "@/lib/queues/admin-queues";
import { getDrilldownHref } from "@/lib/ui/drilldown-links";

export function AdminOperationsControl({
  queueSummary,
  serviceRoleOk,
}: Readonly<{
  queueSummary: AdminQueueSummaryItem[];
  serviceRoleOk: boolean;
}>) {
  return (
    <PageSection title="Operations control" subtitle="Dashboard → Queue → Entity → Action">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {queueSummary.map((item) => (
          <Link
            key={item.queue_type}
            href={item.href}
            className={`group flex h-full min-h-[5.5rem] cursor-pointer flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)] no-underline ${drilldownHoverClass} ${drilldownFocusClass}`}
            aria-label={`Open ${item.label} queue`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              {item.count > 0 ? <StatusBadge label={String(item.count)} status={item.status} /> : null}
            </div>
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-950">{item.count}</p>
            <p className="mt-auto pt-1 text-xs leading-5 text-slate-600 group-hover:text-slate-800">{item.detail}</p>
          </Link>
        ))}
        <Link
          href="/admin/audit"
          className={`group flex h-full min-h-[5.5rem] cursor-pointer flex-col rounded-xl border border-indigo-200/70 bg-indigo-50/30 p-3 shadow-[var(--shadow-panel)] no-underline ${drilldownHoverClass} ${drilldownFocusClass}`}
          aria-label="Open audit center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-800">Audit center</p>
          <p className="mt-2 text-sm font-semibold text-indigo-950">Compliance timeline</p>
          <p className="mt-auto pt-1 text-xs text-indigo-900/80">Evidence packs & export</p>
        </Link>
        <Link
          href={getDrilldownHref("platform_health")}
          className={`group flex h-full min-h-[5.5rem] cursor-pointer flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)] no-underline ${drilldownHoverClass} ${drilldownFocusClass}`}
          aria-label="Open system health"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">System Health</p>
            <StatusBadge label={serviceRoleOk ? "OK" : "!"} status={serviceRoleOk ? "success" : "warning"} />
          </div>
          <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-950">→</p>
          <p className="mt-auto pt-1 text-xs leading-5 text-slate-600 group-hover:text-slate-800">
            {serviceRoleOk ? "Service role configured" : "Configuration check required"}
          </p>
        </Link>
      </div>
    </PageSection>
  );
}
