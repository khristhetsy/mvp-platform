import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { KILLED_AFTER_MS } from "@/lib/cron/run-history";
import { cronJobName } from "@/lib/cron/jobs";
import { loadPausedCrons } from "@/lib/cron/gate";
import { loadHealthSettings } from "@/lib/db-health/run";
import type { HealthSettings, HealthState, IncidentCause } from "@/lib/db-health/evaluate";

export type SampleRow = {
  taken_at: string;
  response_ms: number | null;
  active_connections: number | null;
  longest_query_s: number | null;
  cron_timeouts: number;
  state: HealthState;
};

export type IncidentRow = {
  id: number;
  started_at: string;
  ended_at: string | null;
  peak_state: "warn" | "overload";
  cause: IncidentCause;
  peak_response_ms: number | null;
  peak_query_s: number | null;
  cron_timeouts: number;
  action_taken: string | null;
};

export type LongQuery = { pid: number; seconds: number; query: string };
export type TopQuery = { q: string; calls: number; mean_ms: number; max_ms: number; time_pct: number; call_pct: number };
export type QueryStats = { norms: { queries: number; median_mean_ms: number | null; p90_mean_ms: number | null }; top: TopQuery[] };
export type JobTimeouts = { path: string; name: string; runs: number; timeouts: number };

export type DbHealthData = {
  now: number;
  settings: HealthSettings;
  /** Oldest first, last 7 days. */
  samples: SampleRow[];
  incidents: IncidentRow[];
  jobs: JobTimeouts[];
  /** Null when the SQL for these has not been run yet. */
  longQueries: LongQuery[] | null;
  queryStats: QueryStats | null;
  pausedPaths: string[];
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await db().rpc(name, args);
    return error ? null : (data as T);
  } catch {
    return null;
  }
}

/** Everything the Database health page shows. Each part fails on its own to null or empty. */
export async function loadDbHealth(): Promise<DbHealthData> {
  const client = db();
  const now = Date.now();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();
  const since24h = new Date(now - 86_400_000).toISOString();

  const [settings, samplesRes, incidentsRes, runsRes, longQueries, queryStats, paused] = await Promise.all([
    loadHealthSettings(),
    client
      .from("db_health_samples")
      .select("taken_at, response_ms, active_connections, longest_query_s, cron_timeouts, state")
      .gte("taken_at", since7d)
      .order("taken_at", { ascending: true })
      .limit(2200),
    client
      .from("db_health_incidents")
      .select("id, started_at, ended_at, peak_state, cause, peak_response_ms, peak_query_s, cron_timeouts, action_taken")
      .order("started_at", { ascending: false })
      .limit(20),
    client.from("cron_runs").select("job, status, started_at").gte("started_at", since24h).limit(6000),
    rpc<LongQuery[]>("db_health_long_queries", { p_min_seconds: 5 }),
    rpc<QueryStats>("db_health_query_stats", { p_limit: 6 }),
    loadPausedCrons(),
  ]);

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const samples = ((samplesRes.data ?? []) as SampleRow[]).map((s) => ({ ...s, longest_query_s: num(s.longest_query_s) }));
  const incidents = ((incidentsRes.data ?? []) as IncidentRow[]).map((i) => ({ ...i, peak_query_s: num(i.peak_query_s) }));

  const byJob = new Map<string, { runs: number; timeouts: number }>();
  for (const r of (runsRes.data ?? []) as { job: string; status: string; started_at: string }[]) {
    if (r.status === "skipped") continue;
    const e = byJob.get(r.job) ?? { runs: 0, timeouts: 0 };
    e.runs += 1;
    if (r.status === "running" && now - new Date(r.started_at).getTime() > KILLED_AFTER_MS) e.timeouts += 1;
    byJob.set(r.job, e);
  }
  const jobs = [...byJob.entries()]
    .map(([path, v]) => ({ path, name: cronJobName(path), ...v }))
    .sort((a, b) => b.timeouts - a.timeouts || b.runs - a.runs);

  return {
    now,
    settings,
    samples,
    incidents,
    jobs,
    longQueries: Array.isArray(longQueries) ? longQueries.map((q) => ({ ...q, seconds: Number(q.seconds) })) : null,
    queryStats: queryStats && typeof queryStats === "object" ? queryStats : null,
    pausedPaths: Object.keys(paused),
  };
}
