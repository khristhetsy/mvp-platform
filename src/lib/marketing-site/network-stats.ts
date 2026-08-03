import raw from "../../../data/network-stats.json";

/**
 * Network supply data (upgrade brief Step 1). The single source of truth is
 * data/network-stats.json — populated from the live investor database. Every
 * value ships as "TKTK" until real figures are supplied.
 *
 * FAIL LOUDLY: loadNetworkStats() throws if any "TKTK" placeholder remains, so
 * `next build` fails with a clear error rather than rendering placeholder or
 * invented numbers. No figure is ever hardcoded in a component.
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

function findTKTK(value: unknown, at: string, hits: string[]): void {
  if (value === "TKTK") hits.push(at);
  else if (Array.isArray(value)) value.forEach((v, i) => findTKTK(v, `${at}[${i}]`, hits));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) findTKTK(v, `${at}.${k}`, hits);
  }
}

/** Throws (failing the build) if any "TKTK" placeholder remains in `value`.
 *  Shared by every data-file loader so nothing ships with placeholders. */
export function assertNoTKTK(value: unknown, name: string): void {
  const hits: string[] = [];
  findTKTK(value, name, hits);
  if (hits.length > 0) {
    throw new Error(
      `[${name}] Unpopulated TKTK placeholders — populate the data file before building:\n  ${hits.join("\n  ")}`,
    );
  }
}

export function loadNetworkStats(): NetworkStats {
  assertNoTKTK(raw, "network-stats");
  return raw as unknown as NetworkStats;
}
