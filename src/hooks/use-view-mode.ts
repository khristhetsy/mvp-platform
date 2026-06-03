"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MODULE_DEFAULT_VIEW,
  MODULE_VIEW_MODES,
  parseViewModeParam,
  readStoredViewDensity,
  readStoredViewMode,
  writeStoredViewDensity,
  writeStoredViewMode,
  type ViewDensity,
  type ViewMode,
  type ViewModeModuleId,
  isViewDensity,
} from "@/lib/ui/view-modes";

export function useViewMode(moduleId: ViewModeModuleId) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowedModes = useMemo(() => [...MODULE_VIEW_MODES[moduleId]], [moduleId]);
  const defaultMode = MODULE_DEFAULT_VIEW[moduleId];

  const paramView = parseViewModeParam(searchParams.get("view"), allowedModes);
  const paramDensityRaw = searchParams.get("density");
  const paramDensity = paramDensityRaw && isViewDensity(paramDensityRaw) ? paramDensityRaw : null;
  const paramQuery = searchParams.get("q") ?? "";

  const [viewModeState, setViewModeState] = useState<ViewMode>(
    () => paramView ?? readStoredViewMode(moduleId, allowedModes) ?? defaultMode,
  );
  const [densityState, setDensityState] = useState<ViewDensity>(
    () => paramDensity ?? readStoredViewDensity(moduleId) ?? "comfortable",
  );

  const viewMode = paramView ?? viewModeState;
  const density = paramDensity ?? densityState;
  const query = paramQuery;

  const replaceParams = useCallback(
    (next: { view?: ViewMode; density?: ViewDensity; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.view) params.set("view", next.view);
      if (next.density) params.set("density", next.density);
      if (next.q !== undefined) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      writeStoredViewMode(moduleId, mode);
      replaceParams({ view: mode });
    },
    [moduleId, replaceParams],
  );

  const setDensity = useCallback(
    (next: ViewDensity) => {
      setDensityState(next);
      writeStoredViewDensity(moduleId, next);
      replaceParams({ density: next });
    },
    [moduleId, replaceParams],
  );

  const setQuery = useCallback(
    (next: string) => {
      replaceParams({ q: next });
    },
    [replaceParams],
  );

  return {
    viewMode,
    density,
    query,
    setViewMode,
    setDensity,
    setQuery,
    allowedModes,
  };
}
