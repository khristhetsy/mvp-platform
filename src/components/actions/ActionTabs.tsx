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
  counts,
}: Readonly<{
  active: ActionCenterTab;
  onChange: (tab: ActionCenterTab) => void;
  counts?: Partial<Record<ActionCenterTab, number>>;
}>) {
  return (
    <div
      role="tablist"
      aria-label="Action status"
      className="grid grid-cols-5 gap-2"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
              isActive
                ? "border-2 border-slate-900 bg-slate-50"
                : "border border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                isActive ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {tab.label}
            </span>
            {count !== undefined ? (
              <span
                className={`text-xl font-semibold leading-none ${
                  isActive ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
