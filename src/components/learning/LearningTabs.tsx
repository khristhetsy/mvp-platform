"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

export type LearningTab = {
  key: string;
  label: string;
  badge?: string;
  panel: ReactNode;
};

/** One tab per learning program. The panels are rendered on the server and passed in. */
export function LearningTabs({ tabs }: Readonly<{ tabs: LearningTab[] }>) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActive(tabs[next].key);
    document.getElementById(`learning-tab-${tabs[next].key}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Learning programs" className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab, i) => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              id={`learning-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`learning-panel-${tab.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition ${
                on ? "border-[#1A6CE4] font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.badge && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} id={`learning-panel-${tab.key}`} role="tabpanel" aria-labelledby={`learning-tab-${tab.key}`} hidden={tab.key !== active}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
