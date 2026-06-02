"use client";

import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useViewMode } from "@/hooks/use-view-mode";
import type { ViewModeModuleId } from "@/lib/ui/view-modes";

export function AdminOperationalViewToolbar({
  moduleId,
  sticky = true,
}: Readonly<{ moduleId: ViewModeModuleId; sticky?: boolean }>) {
  const { viewMode, density, setViewMode, setDensity, allowedModes } = useViewMode(moduleId);

  return (
    <ViewToolbar
      viewMode={viewMode}
      allowedModes={allowedModes}
      onViewModeChange={setViewMode}
      density={density}
      onDensityChange={setDensity}
      showSearch={false}
      showSavedViews={false}
      sticky={sticky}
    />
  );
}

