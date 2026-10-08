"use client";

import { useState } from "react";

type Option<T extends string> = { value: T; label: string; icon: string };

/**
 * The Tasks toolbar gear: Show (Active / Archived), Layout (Kanban / List), Group by
 * (Stage / Week, Stage only when the project has stages) and the Month in view. A label
 * beside the gear shows the current choices without opening the menu.
 */
export function TaskViewGear({
  archived, onArchived, view, onView, groupBy, onGroupBy, hasStages, months, monthId, onMonth,
}: {
  archived: boolean;
  onArchived: (v: boolean) => void;
  view: "kanban" | "list";
  onView: (v: "kanban" | "list") => void;
  groupBy: "stage" | "week";
  onGroupBy: (v: "stage" | "week") => void;
  hasStages: boolean;
  months: { id: string; label: string }[];
  monthId: string;
  onMonth: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const show: Option<"active" | "archived">[] = [
    { value: "active", label: "Active", icon: "ti-circle-check" },
    { value: "archived", label: "Archived", icon: "ti-archive" },
  ];
  const layouts: Option<"kanban" | "list">[] = [
    { value: "kanban", label: "Kanban", icon: "ti-layout-kanban" },
    { value: "list", label: "List", icon: "ti-list" },
  ];
  const groups: Option<"stage" | "week">[] = [
    ...(hasStages ? [{ value: "stage" as const, label: "Stage", icon: "ti-columns" }] : []),
    { value: "week", label: "Week", icon: "ti-calendar-week" },
  ];
  const chip = [archived ? "Archived" : "Active", view === "kanban" ? "Kanban" : "List", groupBy === "stage" ? "Stage" : "Week"].join(" · ");

  const caption = (text: string) => <div className="px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-[.05em] text-slate-400">{text}</div>;
  const sep = <div className="my-1 border-t border-slate-100" />;
  function item<T extends string>(o: Option<T>, on: boolean, pick: (v: T) => void) {
    return (
      <button key={o.value} type="button" role="menuitemradio" aria-checked={on} onClick={() => { pick(o.value); setOpen(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] ${on ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}>
        <i className={`ti ${o.icon} text-[15px]`} aria-hidden="true" />
        <span className="flex-1">{o.label}</span>
        {on ? <i className="ti ti-check" aria-hidden="true" /> : null}
      </button>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Task view settings" aria-haspopup="true" aria-expanded={open}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 ${open ? "bg-slate-100" : "bg-white hover:bg-slate-50"}`}>
        <i className="ti ti-settings text-[16px]" aria-hidden="true" />
      </button>
      <span title="Current view. Change it in the gear menu." className="whitespace-nowrap rounded-md bg-indigo-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-indigo-700">{chip}</span>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-[39]" />
          <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-40 w-[270px] rounded-[10px] border border-slate-300 bg-white py-1 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
            {caption("Show")}
            {show.map((o) => item(o, (o.value === "archived") === archived, (v) => onArchived(v === "archived")))}
            {sep}
            {caption("Layout")}
            {layouts.map((o) => item(o, o.value === view, onView))}
            {sep}
            {caption("Group by")}
            {groups.map((o) => item(o, o.value === groupBy, onGroupBy))}
            {months.length ? (
              <>
                {sep}
                {caption("Month")}
                <div className="px-3 pb-2 pt-1">
                  <select value={monthId} onChange={(e) => { onMonth(e.target.value); setOpen(false); }} aria-label="Month"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px]">
                    {months.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </span>
  );
}
