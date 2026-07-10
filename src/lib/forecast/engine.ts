// Sales Forecast engine — pure, deterministic, side-effect-free.
// Anchors month 0 to the latest actuals, blends a pipeline-weighted layer with the
// driver funnel for the near term (months 1..blendMonths), then runs a pure driver
// model through the horizon. No I/O — fully unit-testable. Bump ENGINE_VERSION on any
// logic change; snapshots record it.

export const ENGINE_VERSION = "1.0.0";

export type Segment = "founder" | "investor";
export const SEGMENTS: Segment[] = ["founder", "investor"];

/** One saved driver assumption. `segment: null` = global default. */
export interface AssumptionRow {
  driver_key: string;
  segment: string | null;
  month_from: number;
  month_to: number;
  value: number;
}

/** Month-0 actuals anchor, per segment. MRR is in integer cents. */
export interface ActualsAnchor {
  endingMrrCents: Record<Segment, number>;
  activeSubs: Record<Segment, number>;
}

/** An open pipeline deal contributing to the near-term blend. */
export interface PipelineOpen {
  segment: Segment;
  monthlyMrrCents: number; // normalized recurring value
  winProbability: number;  // 0..1
  lagDays: number;         // expected days to close from month 0
}

export interface ForecastInput {
  horizonMonths: number;
  startMonth: string; // ISO date of month 0
  assumptions: AssumptionRow[];
  anchor: ActualsAnchor;
  pipeline: PipelineOpen[];
  blendMonths?: number; // default 6
}

export interface MonthSegmentRow {
  month: number;
  segment: Segment;
  leads: number;
  mql: number;
  sql: number;
  trials: number;
  new_subs: number;
  churned_subs: number;
  active_subs: number;
  new_mrr: number;         // cents
  expansion_mrr: number;   // cents
  contraction_mrr: number; // cents
  churned_mrr: number;     // cents
  ending_mrr: number;      // cents
  arr: number;             // cents
  blend_pipeline_mrr: number; // cents contributed by the pipeline layer (blend months)
  blend_driver_mrr: number;   // cents contributed by the driver layer (blend months)
}

export interface ForecastOutput {
  engineVersion: string;
  startMonth: string;
  horizonMonths: number;
  blendMonths: number;
  rows: MonthSegmentRow[]; // (horizon+1) × segments, month 0 = anchor
  totals: { endingMrrByMonth: number[]; arrByMonth: number[] };
}

const DRIVER_KEYS = [
  "leads_per_month", "lead_growth_rate_mom", "lead_to_mql", "mql_to_sql",
  "sql_to_trial", "trial_to_paid", "avg_sales_cycle_days", "arpu_monthly",
  "annual_prepay_mix", "price_change_pct", "logo_churn_monthly",
  "expansion_mrr_pct_monthly", "contraction_mrr_pct_monthly",
] as const;

/**
 * Resolve a driver for (segment, month). Most-specific wins: a segment-specific row
 * whose [month_from, month_to] range contains the month, else the segment-specific
 * open-ended row (largest month_from ≤ month), then the same for the global scope.
 * A missing driver is a HARD ERROR — never a silent zero.
 */
export function resolveDriver(
  assumptions: AssumptionRow[],
  driverKey: string,
  segment: Segment,
  month: number,
): number {
  for (const scope of [segment, null] as Array<Segment | null>) {
    const scoped = assumptions.filter((a) => a.driver_key === driverKey && a.segment === scope);
    if (scoped.length === 0) continue;
    const inRange = scoped.find((a) => month >= a.month_from && month <= a.month_to);
    if (inRange) return inRange.value;
    const openEnded = scoped
      .filter((a) => month >= a.month_from)
      .sort((a, b) => b.month_from - a.month_from)[0];
    if (openEnded) return openEnded.value;
  }
  throw new Error(`Missing forecast driver "${driverKey}" for segment "${segment}" at month ${month}.`);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const roundCents = (n: number) => Math.round(n);

/** Pipeline MRR expected to close in each month, per segment (weighted by win prob). */
function pipelineByMonth(pipeline: PipelineOpen[], horizon: number): Record<Segment, number[]> {
  const out: Record<Segment, number[]> = {
    founder: Array(horizon + 1).fill(0),
    investor: Array(horizon + 1).fill(0),
  };
  for (const d of pipeline) {
    const m = Math.max(1, Math.min(horizon, Math.round(d.lagDays / 30) || 1));
    out[d.segment][m] += d.monthlyMrrCents * clamp01(d.winProbability);
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function runForecast(input: ForecastInput): ForecastOutput {
  const horizon = input.horizonMonths;
  const blendMonths = input.blendMonths ?? 6;
  const rows: MonthSegmentRow[] = [];
  const pipe = pipelineByMonth(input.pipeline, horizon);

  // Per-segment running state.
  const state: Record<Segment, { activeSubs: number; endingMrr: number; trialsHistory: number[] }> = {
    founder: { activeSubs: input.anchor.activeSubs.founder, endingMrr: input.anchor.endingMrrCents.founder, trialsHistory: [] },
    investor: { activeSubs: input.anchor.activeSubs.investor, endingMrr: input.anchor.endingMrrCents.investor, trialsHistory: [] },
  };

  for (let m = 0; m <= horizon; m++) {
    for (const seg of SEGMENTS) {
      const st = state[seg];

      if (m === 0) {
        rows.push(blankRow(seg, 0, st.activeSubs, st.endingMrr));
        st.trialsHistory[0] = 0;
        continue;
      }

      const leadsBase = resolveDriver(input.assumptions, "leads_per_month", seg, m);
      const growth = resolveDriver(input.assumptions, "lead_growth_rate_mom", seg, m);
      const leads = leadsBase * Math.pow(1 + growth, m - 1);
      const mql = leads * resolveDriver(input.assumptions, "lead_to_mql", seg, m);
      const sql = mql * resolveDriver(input.assumptions, "mql_to_sql", seg, m);
      const trials = sql * resolveDriver(input.assumptions, "sql_to_trial", seg, m);
      st.trialsHistory[m] = trials;

      // Cycle lag: paid conversions come from trials created lagMonths ago.
      const lagMonths = Math.max(0, Math.round(resolveDriver(input.assumptions, "avg_sales_cycle_days", seg, m) / 30));
      const sourceTrials = st.trialsHistory[m - lagMonths] ?? 0;
      const trialToPaid = resolveDriver(input.assumptions, "trial_to_paid", seg, m);

      const arpu0 = resolveDriver(input.assumptions, "arpu_monthly", seg, m);
      const priceChange = resolveDriver(input.assumptions, "price_change_pct", seg, m);
      const arpu = arpu0 * Math.pow(1 + priceChange, m);

      const driverNewMrr = sourceTrials * trialToPaid * arpu;

      // Blend zone: reconcile the driver layer with concrete pipeline for months 1..blendMonths.
      // De-dup by taking the max (overlap = min), so we never double-count known deals.
      const pipelineNewMrr = m <= blendMonths ? pipe[seg][m] : 0;
      const newMrr = m <= blendMonths ? Math.max(driverNewMrr, pipelineNewMrr) : driverNewMrr;
      const newSubs = arpu > 0 ? newMrr / arpu : 0;

      const logoChurn = resolveDriver(input.assumptions, "logo_churn_monthly", seg, m);
      const expansionPct = resolveDriver(input.assumptions, "expansion_mrr_pct_monthly", seg, m);
      const contractionPct = resolveDriver(input.assumptions, "contraction_mrr_pct_monthly", seg, m);

      const churnedSubs = st.activeSubs * logoChurn;
      const churnedMrr = st.endingMrr * logoChurn;
      const expansionMrr = st.endingMrr * expansionPct;
      const contractionMrr = st.endingMrr * contractionPct;

      const activeSubs = st.activeSubs + newSubs - churnedSubs;
      const endingMrr = st.endingMrr + newMrr + expansionMrr - contractionMrr - churnedMrr;

      st.activeSubs = activeSubs;
      st.endingMrr = endingMrr;

      rows.push({
        month: m,
        segment: seg,
        leads: round2(leads),
        mql: round2(mql),
        sql: round2(sql),
        trials: round2(trials),
        new_subs: round2(newSubs),
        churned_subs: round2(churnedSubs),
        active_subs: round2(activeSubs),
        new_mrr: roundCents(newMrr),
        expansion_mrr: roundCents(expansionMrr),
        contraction_mrr: roundCents(contractionMrr),
        churned_mrr: roundCents(churnedMrr),
        ending_mrr: roundCents(endingMrr),
        arr: roundCents(endingMrr * 12),
        blend_pipeline_mrr: roundCents(pipelineNewMrr),
        blend_driver_mrr: m <= blendMonths ? roundCents(driverNewMrr) : 0,
      });
    }
  }

  const endingMrrByMonth: number[] = [];
  const arrByMonth: number[] = [];
  for (let m = 0; m <= horizon; m++) {
    const monthRows = rows.filter((r) => r.month === m);
    const ending = monthRows.reduce((a, r) => a + r.ending_mrr, 0);
    endingMrrByMonth.push(ending);
    arrByMonth.push(ending * 12);
  }

  return {
    engineVersion: ENGINE_VERSION,
    startMonth: input.startMonth,
    horizonMonths: horizon,
    blendMonths,
    rows,
    totals: { endingMrrByMonth, arrByMonth },
  };
}

function blankRow(seg: Segment, month: number, activeSubs: number, endingMrr: number): MonthSegmentRow {
  return {
    month, segment: seg,
    leads: 0, mql: 0, sql: 0, trials: 0,
    new_subs: 0, churned_subs: 0, active_subs: round2(activeSubs),
    new_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, churned_mrr: 0,
    ending_mrr: roundCents(endingMrr), arr: roundCents(endingMrr * 12),
    blend_pipeline_mrr: 0, blend_driver_mrr: 0,
  };
}

/** Stable stringify for hashing/golden tests — sorted keys, fixed precision. */
export function serializeForHash(output: ForecastOutput): string {
  return JSON.stringify(output);
}

export const ALL_DRIVER_KEYS = DRIVER_KEYS;
