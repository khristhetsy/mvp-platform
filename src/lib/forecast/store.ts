// Sales Forecast data layer. Service-role reads/writes for the sales_forecast_* tables,
// assembling the engine input from real actuals (v_sales_forecast_actuals) + open
// pipeline (sales_opportunities), running the pure engine, and persisting immutable
// snapshots. sales_forecast_* aren't in generated types → loose client.
import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listOpportunities, monthlyRecurringCents, getDefaultPipeline } from "@/lib/sales/opportunities";
import {
  runForecast, ENGINE_VERSION, SEGMENTS,
  type AssumptionRow, type ActualsAnchor, type ForecastOutput, type PipelineOpen, type Segment,
} from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export interface Scenario {
  id: string; name: string; kind: "base" | "upside" | "downside" | "custom";
  horizon_months: number; start_month: string; is_active: boolean; notes: string | null;
  created_at: string; updated_at: string;
}
export interface StoredAssumption extends AssumptionRow { id: string; updated_at: string }
export interface SnapshotMeta {
  id: string; scenario_id: string; computed_at: string; engine_version: string; assumptions_hash: string;
}

// ── Scenarios ────────────────────────────────────────────────────────────────
export async function listScenarios(): Promise<Scenario[]> {
  const { data } = await db().from("sales_forecast_scenarios").select("*").order("created_at", { ascending: true });
  return (data ?? []) as Scenario[];
}
export async function getScenario(id: string): Promise<Scenario | null> {
  const { data } = await db().from("sales_forecast_scenarios").select("*").eq("id", id).maybeSingle();
  return (data as Scenario) ?? null;
}
export async function createScenario(
  input: { name: string; kind?: Scenario["kind"]; notes?: string | null }, createdBy: string,
): Promise<Scenario> {
  const { data, error } = await db().from("sales_forecast_scenarios")
    .insert({ name: input.name, kind: input.kind ?? "custom", notes: input.notes ?? null, created_by: createdBy })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as Scenario;
}
/** Clone a scenario and all its assumptions into a new custom scenario. */
export async function cloneScenario(id: string, name: string, createdBy: string): Promise<Scenario> {
  const src = await getScenario(id);
  if (!src) throw new Error("Scenario not found.");
  const created = await createScenario({ name, kind: "custom", notes: `Cloned from ${src.name}` }, createdBy);
  const rows = await listAssumptions(id);
  if (rows.length > 0) {
    await db().from("sales_forecast_assumptions").insert(
      rows.map((r) => ({
        scenario_id: created.id, driver_key: r.driver_key, segment: r.segment,
        month_from: r.month_from, month_to: r.month_to, value: r.value, updated_by: createdBy,
      })),
    );
  }
  return created;
}

// ── Assumptions ──────────────────────────────────────────────────────────────
export async function listAssumptions(scenarioId: string): Promise<StoredAssumption[]> {
  const { data } = await db().from("sales_forecast_assumptions")
    .select("id, driver_key, segment, month_from, month_to, value, updated_at")
    .eq("scenario_id", scenarioId).order("driver_key");
  return (data ?? []) as StoredAssumption[];
}
/** Replace the full assumption set for a scenario (delete-then-insert, transactional-ish). */
export async function replaceAssumptions(
  scenarioId: string, rows: AssumptionRow[], updatedBy: string,
): Promise<void> {
  await db().from("sales_forecast_assumptions").delete().eq("scenario_id", scenarioId);
  if (rows.length > 0) {
    const { error } = await db().from("sales_forecast_assumptions").insert(
      rows.map((r) => ({
        scenario_id: scenarioId, driver_key: r.driver_key, segment: r.segment ?? null,
        month_from: r.month_from, month_to: r.month_to, value: r.value, updated_by: updatedBy,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

// ── Pipeline weights ─────────────────────────────────────────────────────────
export interface PipelineWeight { id: string; stage_id: string; win_probability: number; expected_lag_days: number; is_active: boolean }
export async function listPipelineWeights(): Promise<PipelineWeight[]> {
  const { data } = await db().from("sales_forecast_pipeline_weights").select("*");
  return (data ?? []) as PipelineWeight[];
}

export interface StageWeight {
  stage_id: string; stage_name: string; sort_order: number; is_won: boolean;
  win_probability: number; expected_lag_days: number; is_active: boolean;
}
/** Every default-pipeline stage joined to its forecast weight (defaults where absent). */
export async function listStageWeights(): Promise<StageWeight[]> {
  const [pipeline, weights] = await Promise.all([getDefaultPipeline(), listPipelineWeights()]);
  const byStage = new Map(weights.map((w) => [w.stage_id, w]));
  return (pipeline?.stages ?? []).map((s) => {
    const w = byStage.get(s.id);
    return {
      stage_id: s.id, stage_name: s.name, sort_order: s.sort_order, is_won: s.is_won,
      win_probability: w?.win_probability ?? (s.is_won ? 1 : 0),
      expected_lag_days: w?.expected_lag_days ?? 30,
      is_active: w?.is_active ?? true,
    };
  });
}
/** Upsert forecast weights for stages. */
export async function saveStageWeights(
  rows: Array<{ stage_id: string; win_probability: number; expected_lag_days: number; is_active: boolean }>,
  updatedBy: string,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db().from("sales_forecast_pipeline_weights").upsert(
    rows.map((r) => ({ ...r, updated_by: updatedBy, updated_at: new Date().toISOString() })),
    { onConflict: "stage_id" },
  );
  if (error) throw new Error(error.message);
}

// ── Actuals anchor (latest month per segment from the view) ──────────────────
export async function loadActualsAnchor(): Promise<ActualsAnchor> {
  const { data } = await db().from("v_sales_forecast_actuals")
    .select("month, segment, active_subs, ending_mrr_cents").order("month", { ascending: false }).limit(24);
  const anchor: ActualsAnchor = { endingMrrCents: { founder: 0, investor: 0 }, activeSubs: { founder: 0, investor: 0 } };
  const seen = new Set<string>();
  for (const r of (data ?? []) as Array<{ segment: string; active_subs: number; ending_mrr_cents: number }>) {
    if (r.segment !== "founder" && r.segment !== "investor") continue;
    if (seen.has(r.segment)) continue; // rows are month-desc → first per segment = latest
    seen.add(r.segment);
    anchor.endingMrrCents[r.segment as Segment] = Number(r.ending_mrr_cents) || 0;
    anchor.activeSubs[r.segment as Segment] = Number(r.active_subs) || 0;
  }
  return anchor;
}

/** Monthly actuals series (all months) for variance + charts. */
export async function loadActualsSeries(): Promise<Array<{ month: string; segment: string; ending_mrr_cents: number; new_mrr_cents: number; churned_mrr_cents: number; active_subs: number }>> {
  const { data } = await db().from("v_sales_forecast_actuals")
    .select("month, segment, ending_mrr_cents, new_mrr_cents, churned_mrr_cents, active_subs").order("month");
  return (data ?? []) as Array<{ month: string; segment: string; ending_mrr_cents: number; new_mrr_cents: number; churned_mrr_cents: number; active_subs: number }>;
}

// ── Open pipeline → engine PipelineOpen[] (segment from CRM side + weights) ───
export async function loadOpenPipeline(ownerId?: string | null): Promise<PipelineOpen[]> {
  const opps = (await listOpportunities(false, ownerId)).filter((o) => o.status === "open");
  if (opps.length === 0) return [];

  // Segment each deal by its CRM contact side (founder|investor), batched.
  const crmIds = [...new Set(opps.map((o) => o.contact_crm_id).filter((x): x is string => Boolean(x)))];
  const sideById = new Map<string, string>();
  if (crmIds.length > 0) {
    const { data } = await db().from("crm_contacts").select("id, side").in("id", crmIds);
    for (const c of (data ?? []) as Array<{ id: string; side: string | null }>) {
      if (c.side) sideById.set(String(c.id), c.side);
    }
  }
  const weights = await listPipelineWeights();
  const weightByStage = new Map(weights.map((w) => [w.stage_id, w]));

  const now = Date.now();
  return opps.map((o): PipelineOpen => {
    const side = o.contact_crm_id ? sideById.get(o.contact_crm_id) : null;
    const segment: Segment = side === "investor" ? "investor" : "founder";
    const w = o.stage_id ? weightByStage.get(o.stage_id) : undefined;
    const winProbability = o.probability != null ? o.probability / 100 : (w?.win_probability ?? 0);
    const lagDays = o.expected_close
      ? Math.max(0, Math.round((Date.parse(o.expected_close) - now) / 86_400_000))
      : (w?.expected_lag_days ?? 30);
    return { segment, monthlyMrrCents: monthlyRecurringCents(o) ?? 0, winProbability, lagDays };
  });
}

// ── Snapshots ────────────────────────────────────────────────────────────────
// Snapshots are partitioned by owner: a member (ownerId set) only sees their own
// scoped snapshots; managers/super admins (ownerId null) see the shared org snapshots.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerFilter(q: any, ownerId?: string | null): any {
  return ownerId ? q.eq("owner_id", ownerId) : q.is("owner_id", null);
}

export async function listSnapshots(scenarioId: string, ownerId?: string | null): Promise<SnapshotMeta[]> {
  let q = db().from("sales_forecast_snapshots")
    .select("id, scenario_id, computed_at, engine_version, assumptions_hash")
    .eq("scenario_id", scenarioId);
  q = ownerFilter(q, ownerId).order("computed_at", { ascending: false });
  const { data } = await q;
  return (data ?? []) as SnapshotMeta[];
}
export async function getSnapshot(id: string, ownerId?: string | null): Promise<{ meta: SnapshotMeta; output: ForecastOutput } | null> {
  const { data } = await db().from("sales_forecast_snapshots").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  // A member can only read their own snapshot; managers only the shared (null-owner) ones.
  const owner = (data as { owner_id?: string | null }).owner_id ?? null;
  if ((ownerId ?? null) !== owner) return null;
  return { meta: data as SnapshotMeta, output: (data as { output: ForecastOutput }).output };
}
export async function getLatestSnapshot(scenarioId: string, ownerId?: string | null): Promise<{ meta: SnapshotMeta; output: ForecastOutput } | null> {
  let q = db().from("sales_forecast_snapshots").select("*").eq("scenario_id", scenarioId);
  q = ownerFilter(q, ownerId).order("computed_at", { ascending: false }).limit(1).maybeSingle();
  const { data } = await q;
  if (!data) return null;
  return { meta: data as SnapshotMeta, output: (data as { output: ForecastOutput }).output };
}

function hashAssumptions(assumptions: AssumptionRow[]): string {
  const canonical = [...assumptions]
    .map((a) => `${a.driver_key}|${a.segment ?? ""}|${a.month_from}|${a.month_to}|${a.value}`)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(`${ENGINE_VERSION}\n${canonical}`).digest("hex");
}

/** Assemble inputs, run the engine, and persist an immutable snapshot. */
export async function computeAndSnapshot(
  scenarioId: string, createdBy: string, ownerId?: string | null,
): Promise<{ snapshotId: string; output: ForecastOutput; assumptionsHash: string }> {
  const scenario = await getScenario(scenarioId);
  if (!scenario) throw new Error("Scenario not found.");
  const [assumptions, anchor, pipeline] = await Promise.all([
    listAssumptions(scenarioId), loadActualsAnchor(), loadOpenPipeline(ownerId),
  ]);

  const output = runForecast({
    horizonMonths: scenario.horizon_months,
    startMonth: scenario.start_month,
    assumptions,
    anchor,
    pipeline,
  });
  const assumptionsHash = hashAssumptions(assumptions);

  const { data, error } = await db().from("sales_forecast_snapshots")
    .insert({ scenario_id: scenarioId, engine_version: ENGINE_VERSION, assumptions_hash: assumptionsHash, output, created_by: createdBy, owner_id: ownerId ?? null })
    .select("id").single();
  if (error) throw new Error(error.message);
  const snapshotId = String(data.id);

  // Append-only system journal entry (best-effort — never fail the compute).
  try {
    const { addSystemJournalEntry } = await import("./journal");
    await addSystemJournalEntry(
      `Forecast snapshot ${snapshotId.slice(0, 8)} computed for "${scenario.name}" — engine ${ENGINE_VERSION}, hash ${assumptionsHash.slice(0, 12)}.`,
      snapshotId,
    );
  } catch { /* journal is best-effort */ }

  return { snapshotId, output, assumptionsHash };
}

// ── Variance (snapshot projection vs actuals per elapsed month) ───────────────
export async function computeVariance(scenarioId: string, ownerId?: string | null): Promise<{
  snapshot: SnapshotMeta | null;
  rows: Array<{ month: string; monthIndex: number; projectedMrrCents: number; actualMrrCents: number; deltaCents: number; deltaPct: number | null }>;
}> {
  const snap = await getLatestSnapshot(scenarioId, ownerId);
  if (!snap) return { snapshot: null, rows: [] };

  // Sum projected ending MRR per month index across segments.
  const projByMonth = snap.output.totals.endingMrrByMonth;
  const start = new Date(snap.output.startMonth);

  // Actuals ending MRR per calendar month (sum segments).
  const actuals = await loadActualsSeries();
  const actualByMonthKey = new Map<string, number>();
  for (const a of actuals) {
    const key = String(a.month).slice(0, 7);
    actualByMonthKey.set(key, (actualByMonthKey.get(key) ?? 0) + (Number(a.ending_mrr_cents) || 0));
  }

  const rows: Array<{ month: string; monthIndex: number; projectedMrrCents: number; actualMrrCents: number; deltaCents: number; deltaPct: number | null }> = [];
  for (let i = 0; i < projByMonth.length; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!actualByMonthKey.has(key)) continue; // only elapsed months with actuals
    const projected = projByMonth[i];
    const actual = actualByMonthKey.get(key) ?? 0;
    const delta = actual - projected;
    rows.push({
      month: key, monthIndex: i, projectedMrrCents: projected, actualMrrCents: actual,
      deltaCents: delta, deltaPct: projected !== 0 ? delta / projected : null,
    });
  }
  return { snapshot: snap.meta, rows };
}

export { SEGMENTS };
