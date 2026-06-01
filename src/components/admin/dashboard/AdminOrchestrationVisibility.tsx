import Link from "next/link";
import { PageSection } from "@/components/ui/workspace-layout";
import type { OrchestrationSummary } from "@/lib/notifications/orchestration/types";

export function AdminOrchestrationVisibility({
  counts,
}: Readonly<{ counts: OrchestrationSummary }>) {
  const items = [
    { label: "Escalated", value: counts.escalatedCount, href: "/admin/actions?tab=escalated&escalated=true" },
    { label: "Blocked", value: counts.blockedCount, href: "/admin/actions?tab=active&status=blocked" },
    { label: "Stalled", value: counts.stalledCount, href: "/admin/actions?category=compliance" },
    { label: "Overdue", value: counts.overdueCount, href: "/admin/actions?tab=overdue&overdue=true" },
  ];

  return (
    <PageSection title="Workflow orchestration" subtitle="Rules-based in-app escalation awareness (no auto-actions)">
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
    </PageSection>
  );
}
