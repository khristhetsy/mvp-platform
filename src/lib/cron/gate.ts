/**
 * The pause switch and run log shared by every scheduled job.
 *
 * Each cron route's GET is wrapped once: `export const GET = withCronGate(path, handler)`.
 * The handler itself is unchanged. For a real scheduled call (valid CRON_SECRET):
 *   - a paused job logs "skipped" and returns 200 without doing its work;
 *   - otherwise the run is logged in cron_runs (start, end, HTTP status, duration).
 * Any other caller goes straight to the handler, which keeps its own auth, so
 * nothing about who may call a job changes.
 *
 * Pause state is one platform_settings row, "paused_crons". The log is
 * best effort: if cron_runs is missing or a write fails, the job still runs.
 */
import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { validateCronSecret } from "@/lib/notifications/cron/auth";

const PAUSED_KEY = "paused_crons";
const LOG_RETENTION_DAYS = 14;

export type PausedEntry = { by: string | null; byName: string | null; at: string };
export type PausedCrons = Record<string, PausedEntry>;

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function loadPausedCrons(): Promise<PausedCrons> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", PAUSED_KEY).maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as PausedCrons) : {};
  } catch {
    return {};
  }
}

/** Pause or resume jobs. Returns the new state, or null when the save failed. */
export async function setCronsPaused(
  paths: string[],
  paused: boolean,
  actor: { id: string; name: string | null },
): Promise<PausedCrons | null> {
  const current = await loadPausedCrons();
  const next: PausedCrons = { ...current };
  const at = new Date().toISOString();
  for (const p of paths) {
    if (paused) next[p] = next[p] ?? { by: actor.id, byName: actor.name, at };
    else delete next[p];
  }
  const { error } = await db()
    .from("platform_settings")
    .upsert({ key: PAUSED_KEY, value: next, updated_by: actor.id, updated_at: at }, { onConflict: "key" });
  return error ? null : next;
}

async function logStart(job: string, status: "running" | "skipped"): Promise<number | null> {
  try {
    const { data } = await db()
      .from("cron_runs")
      .insert({ job, status, ...(status === "skipped" ? { finished_at: new Date().toISOString(), duration_ms: 0 } : {}) })
      .select("id")
      .single();
    return (data as { id?: number } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function logFinish(id: number | null, job: string, startedMs: number, httpStatus: number | null, detail: string | null) {
  if (id === null) return;
  try {
    const client = db();
    await client
      .from("cron_runs")
      .update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        http_status: httpStatus,
        status: httpStatus !== null && httpStatus < 400 ? "ok" : "error",
        detail,
      })
      .eq("id", id);
    await client
      .from("cron_runs")
      .delete()
      .eq("job", job)
      .lt("started_at", new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000).toISOString());
  } catch {
    /* log only */
  }
}

export function withCronGate<R extends Request, Res extends Response>(
  path: string,
  handler: (req: R) => Promise<Res>,
): (req: R) => Promise<Res | NextResponse> {
  return async (req: R) => {
    // Only a genuine scheduled call is gated and logged; anything else is the
    // handler's to accept or refuse, exactly as before.
    if (!validateCronSecret(req)) return handler(req);

    const paused = await loadPausedCrons();
    if (paused[path]) {
      await logStart(path, "skipped");
      return NextResponse.json({ ok: true, skipped: "paused", pausedAt: paused[path]!.at });
    }

    const startedMs = Date.now();
    const runId = await logStart(path, "running");
    try {
      const res = await handler(req);
      await logFinish(runId, path, startedMs, res.status, null);
      return res;
    } catch (err) {
      await logFinish(runId, path, startedMs, null, err instanceof Error ? err.message.slice(0, 300) : "threw");
      throw err;
    }
  };
}

export type CronRunRow = {
  job: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "error" | "skipped";
  http_status: number | null;
  duration_ms: number | null;
  detail: string | null;
};

/** The latest run of each job. Empty map when cron_runs doesn't exist yet. */
export async function loadLatestCronRuns(paths: string[]): Promise<Map<string, CronRunRow>> {
  const out = new Map<string, CronRunRow>();
  try {
    const client = db();
    const rows = await Promise.all(
      paths.map((p) =>
        client
          .from("cron_runs")
          .select("job, started_at, finished_at, status, http_status, duration_ms, detail")
          .eq("job", p)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    );
    for (const r of rows) {
      const row = r.data as CronRunRow | null;
      if (row) out.set(row.job, row);
    }
  } catch {
    /* no log yet */
  }
  return out;
}
