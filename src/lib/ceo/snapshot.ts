// CEO Hub weekly snapshot job. Computes each KPI's weekly value from the real Sales /
// Marketing / Admin-task tables and upserts ceo_kpi_snapshots (weekly grain, Monday).
// KPIs with no source data in the repo yet return null → no snapshot row → UI shows n/a.
// This is the single writer of snapshots; the UI reads them.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

/** Monday (UTC) of the week containing `d`. */
export function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

function weekRange(weekStart: string): { start: string; end: string } {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function count(table: string, build: (q: unknown) => unknown): Promise<number | null> {
  try {
    let q = db().from(table).select("*", { count: "exact", head: true });
    q = build(q) as typeof q;
    const { count: c, error } = await q;
    return error ? null : c ?? 0;
  } catch {
    return null;
  }
}

// Each entry computes one KPI's value for the given week, or null if not computable yet.
type Calc = (r: { start: string; end: string; weekStart: string }) => Promise<number | null>;

const CALCS: Record<string, Calc> = {
  // ── Sales (from sales_opportunities) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sales_new_leads: ({ start, end }) => count("sales_opportunities", (q: any) => q.gte("created_at", start).lt("created_at", end)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sales_new_paid: ({ start, end }) => count("sales_opportunities", (q: any) => q.eq("status", "won").gte("updated_at", start).lt("updated_at", end)),

  // ── Marketing ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mktg_sourced_leads: ({ start, end }) => count("marketing_contacts", (q: any) => q.gte("created_at", start).lt("created_at", end)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mktg_investor_signups: ({ start, end }) => count("profiles", (q: any) => q.eq("role", "investor").gte("created_at", start).lt("created_at", end)),
  mktg_email_ctr: async ({ start, end }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clicked = await count("marketing_events", (q: any) => q.eq("event_type", "clicked").gte("occurred_at", start).lt("occurred_at", end));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivered = await count("marketing_events", (q: any) => q.eq("event_type", "delivered").gte("occurred_at", start).lt("occurred_at", end));
    if (delivered == null || clicked == null || delivered === 0) return null;
    return Math.round((clicked / delivered) * 1000) / 10;
  },

  // ── Operations (from admin_tasks) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ops_tasks_completed: ({ start, end }) => count("admin_tasks", (q: any) => q.eq("status", "done").gte("updated_at", start).lt("updated_at", end)),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ops_overdue_tasks: ({ end }) => count("admin_tasks", (q: any) => q.neq("status", "done").is("archived_at", null).lt("due_date", end.slice(0, 10))),
  ops_cycle_time: async ({ start, end }) => {
    try {
      const { data, error } = await db().from("admin_tasks").select("created_at, updated_at").eq("status", "done").gte("updated_at", start).lt("updated_at", end);
      if (error || !data || data.length === 0) return null;
      const days = (data as Array<{ created_at: string; updated_at: string }>).map((t) => (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000);
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      return Math.round(avg * 10) / 10;
    } catch {
      return null;
    }
  },

  // ── Commitment completion (once meeting-sourced tasks exist) ──
  ops_commitment_completion: async ({ start, end }) => {
    try {
      const { data, error } = await db().from("admin_tasks").select("status, due_date").not("source_meeting_session_id", "is", null).gte("created_at", start).lt("created_at", end);
      if (error || !data || data.length === 0) return null;
      const rows = data as Array<{ status: string; due_date: string | null }>;
      const done = rows.filter((r) => r.status === "done").length;
      return Math.round((done / rows.length) * 1000) / 10;
    } catch {
      return null;
    }
  },
};

export interface SnapshotResult { weekStart: string; computed: string[]; skipped: string[] }

/** Compute + upsert snapshots for one week (default: current week). */
export async function computeWeekSnapshots(week?: string): Promise<SnapshotResult> {
  const weekStart = week ?? mondayOf(new Date());
  const { start, end } = weekRange(weekStart);

  // Only compute KPIs that are both active in the registry and have a calculator.
  const { data: reg } = await db().from("ceo_kpi_registry").select("key").eq("active", true);
  const activeKeys = new Set(((reg ?? []) as Array<{ key: string }>).map((r) => r.key));

  const computed: string[] = [];
  const skipped: string[] = [];
  const rows: Array<{ kpi_key: string; week_start: string; value: number }> = [];

  for (const [key, calc] of Object.entries(CALCS)) {
    if (!activeKeys.has(key)) continue;
    const value = await calc({ start, end, weekStart });
    if (value == null) { skipped.push(key); continue; }
    rows.push({ kpi_key: key, week_start: weekStart, value });
    computed.push(key);
  }
  // KPIs with a registry row but no calculator are intentionally left n/a.
  for (const key of activeKeys) if (!(key in CALCS)) skipped.push(key);

  if (rows.length > 0) {
    await db().from("ceo_kpi_snapshots").upsert(rows, { onConflict: "kpi_key,week_start" });
  }
  return { weekStart, computed, skipped: [...new Set(skipped)] };
}
