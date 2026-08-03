import raw from "../../../data/network-stats.json";

/**
 * Network supply data (upgrade brief Step 1). The single source of truth is
 * data/network-stats.json — populated from the live investor database. Every
 * value ships as "TKTK" until real figures are supplied.
 *
 * GRACEFUL DEGRADE: loadNetworkStats() returns null while any "TKTK" placeholder
 * remains, so the section is omitted and the build stays green. Populate the JSON
 * and the section appears automatically — no code change. No figure is ever
 * hardcoded in a component.
 */

export type MixRow = { label: string; pct: number };
export type NetworkStats = {
  last_updated: string;
  active_mandates: number;
  stage_mix: MixRow[];
  sector_mix: MixRow[];
  geography_mix: MixRow[];
  median_monthly_cap: number;
};

/** True if any "TKTK" placeholder remains anywhere in the value. Shared by the
 *  sibling data-file loaders (funnel-delta, price-anchor). */
export function containsTKTK(value: unknown): boolean {
  if (value === "TKTK") return true;
  if (Array.isArray(value)) return value.some(containsTKTK);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(containsTKTK);
  return false;
}

export function loadNetworkStats(): NetworkStats | null {
  return containsTKTK(raw) ? null : (raw as unknown as NetworkStats);
}
