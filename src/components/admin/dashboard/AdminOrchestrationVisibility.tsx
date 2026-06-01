import Link from "next/link";
import { PageSection } from "@/components/ui/workspace-layout";
import type { OrchestrationSummary } from "@/lib/notifications/orchestration/types";
import type { ScheduledOperationalCounts } from "@/lib/notifications/scheduled/types";

export function AdminOrchestrationVisibility({
  counts,
  scheduledCounts,
}: Readonly<{ counts: OrchestrationSummary; scheduledCounts?: ScheduledOperationalCounts }>) {
  const items = [
    { label: "Escalated", value: counts.escalatedCount, href: "/admin/actions?tab=escalated&escalated=true" },
    { label: "Blocked", value: counts.blockedCount, href: "/admin/actions?tab=active&status=blocked" },
    { label: "Stalled", value: counts.stalledCount, href: "/admin/actions?category=compliance" },
    { label: "Overdue", value: counts.overdueCount, href: "/admin/actions?tab=overdue&overdue=true" },
  ];

  const scheduledItems = scheduledCounts
    ? [
        { label: "Reminders (24h)", value: scheduledCounts.reminderCount, href: "/notifications" },
        { label: "Digests (24h)", value: scheduledCounts.digestCount, href: "/admin/actions" },
        { label: "Need follow-up", value: scheduledCounts.followUpCount, href: "/admin/actions?tab=active" },
        { label: "Repeat overdue", value: scheduledCounts.repeatedOverdueCount, href: "/admin/actions?tab=overdue" },
      ]
    : [];

  return (
    <PageSection title="Workflow orchestration" subtitle="Rules-based in-app digests and reminders (no auto-actions)">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)] no-underline hover:border-indigo-200"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-950">{item.value}</p>
          </Link>
        ))}
      </div>
      {scheduledItems.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scheduledItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 no-underline hover:border-indigo-200"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-950">{item.value}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </PageSection>
  );
}
