"use client";

import type { ActionCenterTab } from "@/lib/actions/types";

const TABS: { id: ActionCenterTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "overdue", label: "Overdue" },
  { id: "escalated", label: "Escalated" },
  { id: "completed", label: "Completed" },
  { id: "snoozed", label: "Snoozed" },
];

export function ActionTabs({
  active,
  onChange,
}: Readonly<{ active: ActionCenterTab; onChange: (tab: ActionCenterTab) => void }>) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-slate-50 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === tab.id ? "bg-white text-[var(--navy)] shadow-sm" : "text-slate-600 hover:text-[var(--navy)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
