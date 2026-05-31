"use client";

import { Suspense } from "react";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useViewMode } from "@/hooks/use-view-mode";
import type { ReactNode } from "react";

function AdminSpvsModuleViewsInner({
  children,
}: Readonly<{
  children: (viewMode: ReturnType<typeof useViewMode>["viewMode"], density: ReturnType<typeof useViewMode>["density"], query: string) => ReactNode;
}>) {
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("admin-spvs");

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
        searchPlaceholder="Search SPVs, companies, or readiness…"
      />
      {children(viewMode, density, query)}
    </>
  );
}

export function AdminSpvsModuleViews({
  children,
}: Readonly<{
  children: (viewMode: ReturnType<typeof useViewMode>["viewMode"], density: ReturnType<typeof useViewMode>["density"], query: string) => ReactNode;
}>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <AdminSpvsModuleViewsInner>{children}</AdminSpvsModuleViewsInner>
    </Suspense>
  );
}
