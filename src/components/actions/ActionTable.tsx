"use client";

import { ActionOrchestrationBadges } from "@/components/actions/ActionOrchestrationBadges";
import { ActionPriorityBadge } from "@/components/actions/ActionPriorityBadge";
import { ActionStatusBadge } from "@/components/actions/ActionStatusBadge";
import type { NextBestAction } from "@/lib/next-best-actions/types";

function isDisplayOverdue(action: NextBestAction): boolean {
  if (action.status === "overdue") return true;
  if (!action.dueAt) return false;
  if (!action.status || !["open", "snoozed", "blocked"].includes(action.status)) return false;
  return new Date(action.dueAt).getTime() < Date.now();
}

export function ActionTable({
  actions,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: Readonly<{
  actions: NextBestAction[];
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (action: NextBestAction) => void;
}>) {
  const selectable = actions.filter((a) => a.persistedId);
  const allSelected = selectable.length > 0 && selectable.every((a) => selectedIds.has(a.persistedId!));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Due</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            const overdue = isDisplayOverdue(action);
            const pid = action.persistedId;
            return (
              <tr
                key={pid ?? action.id}
                className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50/80 ${
                  overdue && action.priority === "critical" ? "bg-red-50/40" : overdue ? "bg-amber-50/30" : ""
                }`}
                onClick={() => onOpen(action)}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {pid ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pid)}
                      onChange={(e) => onToggle(pid, e.target.checked)}
                      aria-label={`Select ${action.title}`}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-[var(--navy)]">{action.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{action.reason}</p>
                  <div className="mt-1">
                    <ActionOrchestrationBadges action={action} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <ActionPriorityBadge priority={action.priority} />
                </td>
                <td className="px-3 py-2">
                  <ActionStatusBadge status={action.status} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{action.category.replaceAll("_", " ")}</td>
                <td className={`px-3 py-2 text-xs ${overdue ? "font-medium text-red-700" : "text-slate-500"}`}>
                  {action.dueAt ? new Date(action.dueAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
