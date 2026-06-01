import type { AutomationRunListItem } from "@/lib/automation/admin-console-types";
import { AutomationStatusBadge } from "@/components/admin/automation/AutomationStatusBadge";
import { AutomationTriggerBadge } from "@/components/admin/automation/AutomationTriggerBadge";

export function AutomationRunCard({
  run,
  onSelect,
}: Readonly<{ run: AutomationRunListItem; onSelect: (id: string) => void }>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(run.id)}
      className="w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-[var(--shadow-panel)] hover:border-indigo-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AutomationStatusBadge status={run.status} />
        {run.dryRun ? (
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
            Dry run
          </span>
        ) : (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-800">
            Live
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {new Date(run.startedAt).toLocaleString()} · {run.durationMs ?? 0}ms
      </p>
      <div className="mt-2">
        <AutomationTriggerBadge trigger={run.triggerType} />
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Actions {run.actionsExecuted} · Skipped {run.actionsSkipped} · Failures {run.failuresCount}
      </p>
    </button>
  );
}
