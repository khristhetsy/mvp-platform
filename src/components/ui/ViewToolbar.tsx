"use client";

import type { ReactNode } from "react";
import { FilterSearchBar } from "@/components/ui/FilterSearchBar";
import { SavedViewPlaceholder } from "@/components/ui/SavedViewPlaceholder";
import { ViewDensityToggle } from "@/components/ui/ViewDensityToggle";
import { ViewModeToggle } from "@/components/ui/ViewModeToggle";
import type { ViewDensity, ViewMode } from "@/lib/ui/view-modes";

export function ViewToolbar({
  viewMode,
  allowedModes,
  onViewModeChange,
  density,
  onDensityChange,
  query,
  onQueryChange,
  searchPlaceholder,
  children,
  showDensity = true,
  showSearch = true,
  showSavedViews = true,
}: Readonly<{
  viewMode: ViewMode;
  allowedModes: readonly ViewMode[];
  onViewModeChange: (mode: ViewMode) => void;
  density: ViewDensity;
  onDensityChange: (density: ViewDensity) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  showDensity?: boolean;
  showSearch?: boolean;
  showSavedViews?: boolean;
}>) {
  return (
    <div className="mb-4 space-y-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center gap-2">
        <ViewModeToggle value={viewMode} allowedModes={allowedModes} onChange={onViewModeChange} />
        {showDensity ? <ViewDensityToggle value={density} onChange={onDensityChange} /> : null}
        {showSavedViews ? <SavedViewPlaceholder /> : null}
        {children}
      </div>
      {showSearch && onQueryChange !== undefined ? (
        <FilterSearchBar value={query ?? ""} onChange={onQueryChange} placeholder={searchPlaceholder} />
      ) : null}
    </div>
  );
}

export function PipelineBoard({
  columns,
  density = "comfortable",
}: Readonly<{
  columns: Array<{ id: string; title: string; subtitle?: string; items: ReactNode[] }>;
  density?: ViewDensity;
}>) {
  const gap = density === "compact" ? "gap-2" : "gap-3";
  const pad = density === "compact" ? "p-2" : "p-3";

  return (
    <div className={`grid ${gap} md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`}>
      {columns.map((column) => (
        <section key={column.id} className={`rounded-xl border border-slate-200/80 bg-[var(--surface-sunken)] ${pad}`}>
          <header className="mb-2 border-b border-slate-200/80 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">{column.title}</h3>
            {column.subtitle ? <p className="mt-0.5 text-[10px] text-slate-500">{column.subtitle}</p> : null}
            <p className="mt-1 text-[10px] font-medium text-slate-400">{column.items.length} items</p>
          </header>
          <div className={`space-y-2 ${column.items.length === 0 ? "py-6 text-center text-xs text-slate-500" : ""}`}>
            {column.items.length === 0 ? "No items" : column.items}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ModuleEmptyState({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[var(--shadow-panel)]">
      <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
