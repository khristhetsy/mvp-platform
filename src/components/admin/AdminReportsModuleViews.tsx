"use client";

import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { ContentGrid, PageSection } from "@/components/ui/workspace-layout";

type ViewMode = "kanban" | "grid" | "list";

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
  const t = useTranslations("adminCmp");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const filtered = useMemo(() => filterSections(sections, query), [sections, query]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_report_types")}
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "kanban" ? "⊞ Kanban" : v === "grid" ? "⊟ Grid" : "≡ List"}
            </button>
          ))}
        </div>
      </div>

      <PageSection title={t("report_catalog")} subtitle={t("internal_audit_exports_not_legal_filings")}>
        {filtered.length === 0 ? (
          <ModuleEmptyState title={t("no_matching_reports")} description={t("try_a_different_search_term")} />
        ) : view === "kanban" ? (
          <ContentGrid columns={3}>
            {filtered.map((section) => (
              <WorkspacePanel key={section.reportType} title={section.title} subtitle={section.description}>
                <p className="text-xs text-slate-500">
                  Report type: <span className="font-mono text-slate-700">{section.reportType}</span>
                </p>
              </WorkspacePanel>
            ))}
          </ContentGrid>
        ) : view === "grid" ? (
          <ContentGrid columns={2}>
            {filtered.map((section) => (
              <WorkspacePanel key={section.reportType} title={section.title} subtitle={section.description}>
                <p className="text-xs text-slate-500">
                  Report type: <span className="font-mono text-slate-700">{section.reportType}</span>
                </p>
              </WorkspacePanel>
            ))}
          </ContentGrid>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">Report</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((section) => (
                  <tr key={section.reportType} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{section.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{section.reportType}</td>
                    <td className="px-4 py-3 text-slate-500">{section.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {children}
    </>
  );
}

export function AdminReportsModuleViews(
  props: Readonly<{ sections: AdminReportSection[]; children: ReactNode }>,
) {
  const t = useTranslations("adminCmp");
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_view_options")}</p>}>
      <AdminReportsModuleViewsInner {...props} />
    </Suspense>
  );
}
