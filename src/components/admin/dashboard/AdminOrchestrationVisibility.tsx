import Link from "next/link";
import { PageSection } from "@/components/ui/workspace-layout";
import type { OrchestrationSummary } from "@/lib/notifications/orchestration/types";
import type { OrchestrationExecutionSummary } from "@/lib/notifications/orchestration/execution-log";
import type { ScheduledOperationalCounts } from "@/lib/notifications/scheduled/types";
import type { AutomationDailySummary } from "@/components/admin/dashboard/types";

export function AdminOrchestrationVisibility({
  counts,
  scheduledCounts,
  executionSummary,
  automationSummary,
}: Readonly<{
  counts: OrchestrationSummary;
  scheduledCounts?: ScheduledOperationalCounts;
  executionSummary?: OrchestrationExecutionSummary;
  automationSummary?: AutomationDailySummary;
}>) {
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

  const cronItems = executionSummary
    ? [
        {
          label: "Last cron run",
          value: executionSummary.lastRun
            ? new Date(executionSummary.lastRun.started_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
              })
            : "—",
          sub: executionSummary.lastRun?.status ?? "none",
        },
        {
          label: "Last digest",
          value: executionSummary.lastDigestAt
            ? new Date(executionSummary.lastDigestAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
              })
            : "—",
          sub: "persisted",
        },
        {
          label: "Failed runs today",
          value: String(executionSummary.failedRunsToday),
          sub: "partial/failed",
        },
        {
          label: "Reminders today",
          value: String(executionSummary.remindersGeneratedToday),
          sub: "from cron passes",
        },
      ]
    : [];

  const automationItems = automationSummary
    ? [
        { label: "Automations today", value: automationSummary.automationsTriggeredToday },
        { label: "Blocked workflows", value: automationSummary.blockedWorkflows },
        { label: "Deps resolved today", value: automationSummary.dependenciesResolvedToday },
        { label: "Automation failures", value: automationSummary.automationFailuresToday },
      ]
    : [];

  return (
    <PageSection
      title="Workflow orchestration"
      subtitle="Rules-based in-app digests, reminders, and deterministic workflow automation"
    >
      {cronItems.length > 0 ? (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cronItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-indigo-200/60 bg-indigo-50/30 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{item.value}</p>
              <p className="mt-0.5 text-[10px] text-indigo-700/80">{item.sub}</p>
            </div>
          ))}
        </div>
      ) : null}
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
      {automationItems.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {automationItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">{item.label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </PageSection>
  );
}
