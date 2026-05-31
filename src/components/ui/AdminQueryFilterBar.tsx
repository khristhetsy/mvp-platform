"use client";

import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { AdminFilterPage } from "@/lib/ui/query-filters";

export function ActiveFilterChips({
  chips,
}: Readonly<{
  chips: Array<{ key: string; label: string; value: string }>;
}>) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={`${chip.key}:${chip.value}`}
          className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-900"
        >
          <span className="text-indigo-600">{chip.label}:</span>
          <span>{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

export function ClearFiltersButton({
  onClear,
  disabled,
}: Readonly<{
  onClear: () => void;
  disabled?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Clear filters
    </button>
  );
}

export function AdminQueryFilterBar({
  page,
  className = "",
}: Readonly<{
  page: AdminFilterPage;
  className?: string;
}>) {
  const { chips, hasActiveFilters, clearFilters } = useAdminQueryFilters(page);

  if (!hasActiveFilters) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${className}`}
      role="region"
      aria-label="Active filters"
    >
      <ActiveFilterChips chips={chips} />
      <ClearFiltersButton onClear={() => clearFilters()} />
    </div>
  );
}
