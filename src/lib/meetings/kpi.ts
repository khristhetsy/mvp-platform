// Weekly Meeting System — Step 4 KPI engine data layer. Per-department, per-agent
// weekly Data Input + auto/pinned goals + roll-ups. Reads the v_ceo_kpi_meeting_* views
// and the SQL auto-goal/refresh functions. Service-role via admin routes.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type KpiUnit = "count" | "percent" | "currency";
export type GoalPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
export interface KpiDefinition { id: string; department_id: string; key: string; label: string; unit: KpiUnit; position: number; is_active: boolean }
export interface KpiEntry { kpi_id: string; week_start: string; value: number }
export interface RollupRow { kpi_id: string; department_id: string; label: string; unit: KpiUnit; actual: number; goal: number; pct: number | null; owed: number }

/** Recent Monday week-starts (YYYY-MM-DD), oldest → newest. */
export function recentMondays(n = 8): string[] {
  const d = new Date();
  const day = d.getDay(); // 0 Sun … 1 Mon
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7)); // this week's Monday
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const w = new Date(monday);
    w.setDate(monday.getDate() - i * 7);
    out.push(`${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, "0")}-${String(w.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export async function listDefinitions(departmentId?: string): Promise<KpiDefinition[]> {
  let q = db().from("ceo_kpi_meeting_definitions").select("*").eq("is_active", true).order("position");
  if (departmentId) q = q.eq("department_id", departmentId);
  const { data } = await q;
  return (data ?? []) as KpiDefinition[];
}

export async function createDefinition(departmentId: string, key: string, label: string, unit: KpiUnit): Promise<KpiDefinition> {
  const { data, error } = await db().from("ceo_kpi_meeting_definitions").insert({ department_id: departmentId, key, label, unit }).select("*").single();
  if (error) throw new Error(error.message);
  return data as KpiDefinition;
}

/** Department-level entries (agent_id null) for a set of KPIs across recent weeks. */
export async function listEntries(kpiIds: string[], weeks: string[]): Promise<Record<string, Record<string, number>>> {
  if (kpiIds.length === 0) return {};
  const { data } = await db().from("ceo_kpi_meeting_entries").select("kpi_id, week_start, value").in("kpi_id", kpiIds).is("agent_id", null).in("week_start", weeks);
  const map: Record<string, Record<string, number>> = {};
  for (const r of (data ?? []) as Array<{ kpi_id: string; week_start: string; value: number }>) {
    (map[r.kpi_id] ??= {})[String(r.week_start).slice(0, 10)] = Number(r.value);
  }
  return map;
}

export async function upsertEntry(kpiId: string, weekStart: string, value: number, userId: string): Promise<void> {
  const { error } = await db().from("ceo_kpi_meeting_entries")
    .upsert({ kpi_id: kpiId, agent_id: null, week_start: weekStart, value, entered_by: userId, updated_at: new Date().toISOString() }, { onConflict: "kpi_id,agent_id,week_start" });
  if (error) throw new Error(error.message);
}

const VIEW: Record<GoalPeriod, string> = {
  weekly: "v_ceo_kpi_meeting_weekly", monthly: "v_ceo_kpi_meeting_monthly",
  quarterly: "v_ceo_kpi_meeting_quarterly", yearly: "v_ceo_kpi_meeting_ytd",
};

export async function loadRollup(period: GoalPeriod, departmentId?: string): Promise<RollupRow[]> {
  let q = db().from(VIEW[period]).select("kpi_id, department_id, label, unit, actual, goal");
  if (departmentId) q = q.eq("department_id", departmentId);
  const { data } = await q;
  return ((data ?? []) as Array<Omit<RollupRow, "pct" | "owed">>).map((r) => ({
    ...r, actual: Number(r.actual), goal: Number(r.goal),
    pct: Number(r.goal) > 0 ? Math.round((Number(r.actual) / Number(r.goal)) * 100) : null,
    owed: Math.max(0, Number(r.goal) - Number(r.actual)),
  }));
}

export interface GoalPatch { mode?: "auto" | "pinned"; pinned_value?: number | null; growth_factor?: number; ratchet_only?: boolean }
export async function setGoal(kpiId: string, period: GoalPeriod, patch: GoalPatch, userId: string): Promise<void> {
  const row: Record<string, unknown> = { kpi_id: kpiId, period };
  if (patch.mode) row.mode = patch.mode;
  if (patch.pinned_value !== undefined) { row.pinned_value = patch.pinned_value; row.pinned_by = userId; }
  if (patch.growth_factor !== undefined) row.growth_factor = patch.growth_factor;
  if (patch.ratchet_only !== undefined) row.ratchet_only = patch.ratchet_only;
  const { error } = await db().from("ceo_kpi_meeting_goals").upsert(row, { onConflict: "kpi_id,period" });
  if (error) throw new Error(error.message);
  await refreshGoals();
}

/** Recompute + materialize all goal values (cron + after a pin/override). */
export async function refreshGoals(): Promise<number> {
  const { data, error } = await db().rpc("refresh_meeting_kpi_goals");
  if (error) throw new Error(error.message);
  return Number(data) || 0;
}
