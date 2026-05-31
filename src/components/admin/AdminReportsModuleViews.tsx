"use client";

import { Suspense, useMemo, type ReactNode } from "react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { ModuleEmptyState, ViewToolbar } from "@/components/ui/ViewToolbar";
import { useViewMode } from "@/hooks/use-view-mode";

export type AdminReportSection = {
  title: string;
  description: string;
  reportType: string;
};

function filterSections(sections: AdminReportSection[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.reportType.toLowerCase().includes(q),
  );
}

function AdminReportsModuleViewsInner({
  sections,
  children,
}: Readonly<{
  sections: AdminReportSection[];
  children: ReactNode;
}>) {
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("admin-reports");

  const filtered = useMemo(() => filterSections(sections, query), [sections, query]);

  return (
    <>
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search report types…"
        showDensity
      />

      {filtered.length === 0 ? (
        <ModuleEmptyState title="No matching reports" description="Try a different search term." />
      ) : viewMode === "card" ? (
        <section className={`mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${density === "compact" ? "gap-3" : "gap-4"}`}>
          {filtered.map((section) => (
            <WorkspacePanel key={section.reportType} title={section.title} subtitle={section.description}>
              <p className="text-xs text-slate-500">
                Report type: <span className="font-mono text-slate-700">{section.reportType}</span>
              </p>
            </WorkspacePanel>
          ))}
        </section>
      ) : (
        <section className="mb-8">
          <DataTable density={density}>
            <DataTableHead>
              <DataTableHeaderCell>Report</DataTableHeaderCell>
              <DataTableHeaderCell>Type</DataTableHeaderCell>
              <DataTableHeaderCell>Description</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {filtered.map((section) => (
                <DataTableRow key={section.reportType}>
                  <DataTableCell className="font-medium text-slate-900">{section.title}</DataTableCell>
                  <DataTableCell>
                    <span className="font-mono text-xs">{section.reportType}</span>
                  </DataTableCell>
                  <DataTableCell className="max-w-lg text-xs leading-5">{section.description}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </section>
      )}

      {children}
    </>
  );
}

export function AdminReportsModuleViews(
  props: Readonly<{ sections: AdminReportSection[]; children: ReactNode }>,
) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <AdminReportsModuleViewsInner {...props} />
    </Suspense>
  );
}
