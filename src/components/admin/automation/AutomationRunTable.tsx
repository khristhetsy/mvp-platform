import type { AutomationRunListItem } from "@/lib/automation/admin-console-types";
import { AutomationStatusBadge } from "@/components/admin/automation/AutomationStatusBadge";
import { AutomationTriggerBadge } from "@/components/admin/automation/AutomationTriggerBadge";

export function AutomationRunTable({
  runs,
  onSelect,
}: Readonly<{ runs: AutomationRunListItem[]; onSelect: (id: string) => void }>) {
  if (!runs.length) {
    return <p className="text-sm text-slate-600">No automation runs match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
      <table className="min-w-full text-left text-sm" aria-label="Automation runs">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Started</th>
            <th scope="col" className="px-3 py-2">Duration</th>
            <th scope="col" className="px-3 py-2">Trigger</th>
            <th scope="col" className="px-3 py-2">Mode</th>
            <th scope="col" className="px-3 py-2">Actions</th>
            <th scope="col" className="px-3 py-2">Blockers</th>
            <th scope="col" className="px-3 py-2">Failures</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/30"
              tabIndex={0}
              aria-label={`View automation run started ${new Date(run.startedAt).toLocaleString()}`}
              onClick={() => onSelect(run.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(run.id);
                }
              }}
            >
              <td className="px-3 py-2">
                <AutomationStatusBadge status={run.status} />
              </td>
              <td className="px-3 py-2 text-xs text-slate-700">
                {new Date(run.startedAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{run.durationMs ?? "—"}ms</td>
              <td className="px-3 py-2">
                <AutomationTriggerBadge trigger={run.triggerType} />
              </td>
              <td className="px-3 py-2 text-xs">{run.dryRun ? "Dry" : "Live"}</td>
              <td className="px-3 py-2 font-mono text-xs">{run.actionsExecuted}</td>
              <td className="px-3 py-2 font-mono text-xs">{run.blockersDetected}</td>
              <td className="px-3 py-2 font-mono text-xs">{run.failuresCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
