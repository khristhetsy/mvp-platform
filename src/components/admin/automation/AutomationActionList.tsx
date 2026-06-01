import type { AutomationActionListItem } from "@/lib/automation/admin-console-types";

export function AutomationActionList({ actions }: Readonly<{ actions: AutomationActionListItem[] }>) {
  if (!actions.length) {
    return <p className="text-xs text-slate-600">No actions recorded for this run.</p>;
  }

  return (
    <ul className="space-y-2">
      {actions.map((action) => (
        <li key={action.id} className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-slate-900">{action.actionType}</span>
            <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] uppercase">
              {action.status}
            </span>
            <span className="text-slate-500">{new Date(action.createdAt).toLocaleTimeString()}</span>
          </div>
          {action.message ? <p className="mt-1 text-slate-700">{action.message}</p> : null}
          {action.targetEntityType ? (
            <p className="mt-1 text-slate-500">
              Entity: {action.targetEntityType}
              {action.targetEntityId ? ` · ${action.targetEntityId.slice(0, 8)}…` : ""}
            </p>
          ) : null}
          {action.skipReason ? (
            <p className="mt-1 font-medium text-amber-800">Skip: {action.skipReason}</p>
          ) : null}
          {action.dedupeKey ? (
            <p className="mt-1 font-mono text-[10px] text-slate-500">Dedupe: {action.dedupeKey}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
