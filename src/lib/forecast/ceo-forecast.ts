// Thin, read-only Base-scenario headline for the CEO Hub Sales tab. Follows the
// codebase convention (CEO Hub reads via lib, not SQL views). No write paths.
import { listScenarios, getLatestSnapshot, computeVariance } from "./store";

export interface CeoSalesForecast {
  scenarioName: string;
  projectedArrCents: number | null;
  endingMrrByMonth: number[];
  varianceToDateCents: number | null;
  computedAt: string;
}

export async function getCeoSalesForecast(): Promise<CeoSalesForecast | null> {
  const scenarios = await listScenarios();
  const base = scenarios.find((s) => s.is_active && s.kind === "base") ?? scenarios.find((s) => s.kind === "base");
  if (!base) return null;
  const snap = await getLatestSnapshot(base.id);
  if (!snap) return null;
  const arr = snap.output.totals.arrByMonth;
  let varianceToDateCents: number | null = null;
  try {
    const variance = await computeVariance(base.id);
    varianceToDateCents = variance.rows.length ? variance.rows[variance.rows.length - 1].deltaCents : null;
  } catch { /* variance is best-effort */ }
  return {
    scenarioName: base.name,
    projectedArrCents: arr.length ? arr[arr.length - 1] : null,
    endingMrrByMonth: snap.output.totals.endingMrrByMonth,
    varianceToDateCents,
    computedAt: snap.meta.computed_at,
  };
}
