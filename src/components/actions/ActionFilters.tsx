"use client";

import type { ActionCenterFilters } from "@/lib/actions/types";
import { NEXT_BEST_ACTION_CATEGORIES, NEXT_BEST_ACTION_PRIORITIES } from "@/lib/next-best-actions/types";

export function ActionFilters({
  filters,
  onChange,
  onClear,
}: Readonly<{
  filters: ActionCenterFilters;
  onChange: (patch: Partial<ActionCenterFilters>) => void;
  onClear: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4">
      <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Search</span>
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => onChange({ q: e.target.value || undefined })}
          placeholder="Title, reason, category…"
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Priority</span>
        <select
          value={filters.priority ?? ""}
          onChange={(e) => onChange({ priority: (e.target.value || undefined) as ActionCenterFilters["priority"] })}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          <option value="">All</option>
          {NEXT_BEST_ACTION_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Category</span>
        <select
          value={filters.category ?? ""}
          onChange={(e) => onChange({ category: (e.target.value || undefined) as ActionCenterFilters["category"] })}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          <option value="">All</option>
          {NEXT_BEST_ACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={Boolean(filters.overdue)}
          onChange={(e) => onChange({ overdue: e.target.checked || undefined })}
        />
        Overdue only
      </label>
      <button
        type="button"
        onClick={onClear}
        className="self-end rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Clear filters
      </button>
    </div>
  );
}
