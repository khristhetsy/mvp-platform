import type { LucideIcon } from "lucide-react";
import { BarChart3, Clock, Columns3, LayoutGrid, PieChart, Table2 } from "lucide-react";

export const VIEW_MODES = ["table", "card", "pipeline", "timeline", "segments", "analytics"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_DENSITIES = ["compact", "comfortable"] as const;

export type ViewDensity = (typeof VIEW_DENSITIES)[number];

export type ViewModeModuleId =
  | "founder-investors"
  | "investor-opportunities"
  | "admin-companies"
  | "admin-spvs"
  | "admin-reports"
  | "admin-actions"
  | "admin-automation"
  | "admin-audit"
  | "admin-analytics"
  | "admin-insights"
  | "admin-imports";

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  table: "Table",
  card: "Cards",
  pipeline: "Pipeline",
  timeline: "Timeline",
  segments: "Segments",
  analytics: "Analytics",
};

export const VIEW_MODE_ICONS: Record<ViewMode, LucideIcon> = {
  table: Table2,
  card: LayoutGrid,
  pipeline: Columns3,
  timeline: Clock,
  segments: PieChart,
  analytics: BarChart3,
};

export const VIEW_DENSITY_LABELS: Record<ViewDensity, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
};

export const MODULE_VIEW_MODES: Record<ViewModeModuleId, readonly ViewMode[]> = {
  "founder-investors": ["table", "card", "pipeline", "timeline"],
  "investor-opportunities": ["card", "table", "pipeline", "timeline"],
  "admin-companies": ["table", "card", "pipeline", "timeline"],
  "admin-spvs": ["table", "card", "pipeline"],
  "admin-reports": ["card", "table"],
  "admin-actions": ["table", "card", "pipeline", "timeline"],
  "admin-automation": ["analytics", "table", "timeline"],
  "admin-audit": ["analytics", "timeline", "table"],
  "admin-analytics": ["analytics", "table", "segments"],
  "admin-insights": ["analytics", "table", "segments"],
  "admin-imports": ["card", "table", "timeline"],
};

export const MODULE_DEFAULT_VIEW: Record<ViewModeModuleId, ViewMode> = {
  "founder-investors": "card",
  "investor-opportunities": "card",
  "admin-companies": "card",
  "admin-spvs": "card",
  "admin-reports": "card",
  "admin-actions": "table",
  "admin-automation": "analytics",
  "admin-audit": "analytics",
  "admin-analytics": "analytics",
  "admin-insights": "analytics",
  "admin-imports": "card",
};

const VIEW_STORAGE_PREFIX = "capitalos:view-mode:";
const DENSITY_STORAGE_PREFIX = "capitalos:view-density:";

export function isViewMode(value: string): value is ViewMode {
  return (VIEW_MODES as readonly string[]).includes(value);
}

export function isViewDensity(value: string): value is ViewDensity {
  return (VIEW_DENSITIES as readonly string[]).includes(value);
}

export function parseViewModeParam(value: string | null, allowed: readonly ViewMode[]): ViewMode | null {
  if (!value || !isViewMode(value)) return null;
  return allowed.includes(value) ? value : null;
}

export function readStoredViewMode(moduleId: ViewModeModuleId, allowed: readonly ViewMode[]): ViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${VIEW_STORAGE_PREFIX}${moduleId}`);
    if (!raw || !isViewMode(raw)) return null;
    return allowed.includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredViewMode(moduleId: ViewModeModuleId, mode: ViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${VIEW_STORAGE_PREFIX}${moduleId}`, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function readStoredViewDensity(moduleId: ViewModeModuleId): ViewDensity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DENSITY_STORAGE_PREFIX}${moduleId}`);
    if (!raw || !isViewDensity(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeStoredViewDensity(moduleId: ViewModeModuleId, density: ViewDensity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DENSITY_STORAGE_PREFIX}${moduleId}`, density);
  } catch {
    // ignore
  }
}

export function buildViewQueryString(
  current: URLSearchParams | string,
  updates: { view?: ViewMode; density?: ViewDensity; q?: string },
): string {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  if (updates.view) params.set("view", updates.view);
  if (updates.density) params.set("density", updates.density);
  if (updates.q !== undefined) {
    if (updates.q) params.set("q", updates.q);
    else params.delete("q");
  }
  return params.toString();
}

export function resolveViewMode(input: {
  moduleId: ViewModeModuleId;
  paramView: string | null;
  paramDensity?: string | null;
}): { viewMode: ViewMode; density: ViewDensity } {
  const allowed = MODULE_VIEW_MODES[input.moduleId];
  const fromParam = parseViewModeParam(input.paramView, allowed);
  const fromStorage = readStoredViewMode(input.moduleId, allowed);
  const viewMode = fromParam ?? fromStorage ?? MODULE_DEFAULT_VIEW[input.moduleId];

  let density: ViewDensity = "comfortable";
  if (input.paramDensity && isViewDensity(input.paramDensity)) {
    density = input.paramDensity;
  } else {
    density = readStoredViewDensity(input.moduleId) ?? "comfortable";
  }

  return { viewMode, density };
}
