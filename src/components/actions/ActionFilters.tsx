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
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white py-2.5">
      <input
        type="search"
        value={filters.q ?? ""}
        onChange={(e) => onChange({ q: e.target.value || undefined })}
        placeholder="Search actions…"
        className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
      />
      <select
        value={filters.priority ?? ""}
        onChange={(e) => onChange({ priority: (e.target.value || undefined) as ActionCenterFilters["priority"] })}
        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700"
      >
        <option value="">All priorities</option>
        {NEXT_BEST_ACTION_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        value={filters.category ?? ""}
        onChange={(e) => onChange({ category: (e.target.value || undefined) as ActionCenterFilters["category"] })}
        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700"
      >
        <option value="">All categories</option>
        {NEXT_BEST_ACTION_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600">
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
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  );
}
