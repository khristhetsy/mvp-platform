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

export function ActionCard({
  action,
  selected,
  onSelect,
  onOpen,
}: Readonly<{
  action: NextBestAction;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
}>) {
  const overdue = isDisplayOverdue(action);
  const rowKey = action.persistedId ?? action.id;

  return (
    <article
      className={`rounded-lg border px-4 py-3 transition-colors ${
        overdue && action.priority === "critical"
          ? "border-red-300 bg-red-50/60"
          : overdue
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-100 bg-slate-50/80"
      }`}
    >
      <div className="flex items-start gap-3">
        {action.persistedId ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-1"
            aria-label={`Select ${action.title}`}
          />
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open action: ${action.title}`}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <ActionPriorityBadge priority={action.priority} />
            <ActionStatusBadge status={action.status} />
            <ActionOrchestrationBadges action={action} />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{action.category.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--navy)]">{action.title}</p>
          {action.description ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{action.description}</p> : null}
          <p className="mt-1 text-xs text-slate-500">{action.reason}</p>
          {action.dueAt ? (
            <p className={`mt-1 text-xs ${overdue ? "font-medium text-red-700" : "text-slate-600"}`}>
              Due {new Date(action.dueAt).toLocaleString()}
            </p>
          ) : null}
        </button>
      </div>
    </article>
  );
}
