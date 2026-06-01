"use client";

import { getActionOrchestrationHints } from "@/lib/notifications/orchestration/hints";
import type { NextBestAction } from "@/lib/next-best-actions/types";

function Badge({ label, className }: Readonly<{ label: string; className: string }>) {
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

export function ActionOrchestrationBadges({ action }: Readonly<{ action: NextBestAction }>) {
  const hints = getActionOrchestrationHints(action);

  if (!hints.overdue && !hints.escalated && !hints.blocked && !hints.inactivity && !hints.reminder) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {hints.needsAttention ? <Badge label="Needs attention" className="border-rose-200 bg-rose-50 text-rose-800" /> : null}
      {hints.overdue ? (
        <Badge
          label="Overdue"
          className={
            action.priority === "critical"
              ? "border-red-300 bg-red-100 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }
        />
      ) : null}
      {hints.escalated ? <Badge label="Escalated" className="border-amber-300 bg-amber-100 text-amber-950" /> : null}
      {hints.blocked ? <Badge label="Blocked" className="border-orange-200 bg-orange-50 text-orange-900" /> : null}
      {hints.inactivity ? <Badge label="Inactive" className="border-slate-200 bg-slate-100 text-slate-700" /> : null}
      {hints.reminder && !hints.overdue ? <Badge label="Reminder" className="border-indigo-200 bg-indigo-50 text-indigo-800" /> : null}
    </div>
  );
}
