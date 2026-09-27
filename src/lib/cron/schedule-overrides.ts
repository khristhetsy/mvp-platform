/**
 * Schedule changes made on Admin, System, Scheduled jobs (cron_schedule_overrides).
 *
 * A job with a custom schedule is started by the dispatcher (/api/cron/job-dispatcher,
 * every 5 minutes) instead of its vercel.json trigger, which the cron gate then
 * skips. A one-off next run starts the job once at that time; its usual schedule
 * carries on. Run now starts it straight away. Every start is an ordinary
 * scheduled call, so the pause switch, run log and Sent tab all apply.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/notifications/cron/auth";
import { getAppUrl } from "@/lib/env";
import { dueNow, splitCron, type OverrideRow } from "@/lib/cron/zoned-schedule";

/** Header on calls the dispatcher (or Run now) makes, so the gate lets them through. */
export const DISPATCH_HEADER = "x-cron-dispatch";
export const DISPATCHER_PATH = "/api/cron/job-dispatcher";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Every override, by job path. Empty when the table is missing or unreadable. */
export async function loadScheduleOverrides(): Promise<Map<string, OverrideRow>> {
  try {
    const { data, error } = await db().from("cron_schedule_overrides").select("job, cron, next_run_at, last_dispatch_at, updated_at");
    if (error || !data) return new Map();
    return new Map((data as OverrideRow[]).map((r) => [r.job, r]));
  } catch {
    return new Map();
  }
}

/** True when the job follows a custom schedule, so its vercel.json trigger is skipped. */
export async function hasCustomSchedule(path: string): Promise<boolean> {
  try {
    const { data } = await db().from("cron_schedule_overrides").select("cron").eq("job", path).maybeSingle();
    return Boolean((data as { cron: string | null } | null)?.cron);
  } catch {
    return false;
  }
}

/** Save a custom schedule and/or one-off next run. Both null resets the job to its default. */
export async function saveScheduleOverride(
  path: string,
  change: { cron: string[] | null; nextRunAt: Date | null },
  actorId: string,
): Promise<boolean> {
  const client = db();
  if (!change.cron && !change.nextRunAt) {
    const { error } = await client.from("cron_schedule_overrides").delete().eq("job", path);
    return !error;
  }
  const { error } = await client.from("cron_schedule_overrides").upsert(
    {
      job: path,
      cron: change.cron ? change.cron.join("; ") : null,
      next_run_at: change.nextRunAt ? change.nextRunAt.toISOString() : null,
      // A new schedule counts from now, so saving never fires a missed run.
      last_dispatch_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job" },
  );
  return !error;
}

/**
 * Start a job now, as a scheduled call. Returns once the job has been reached;
 * the job keeps running in its own invocation and shows in Last runs.
 */
export async function triggerJob(path: string): Promise<{ ok: boolean; error?: string }> {
  const secret = getCronSecret();
  const base = getAppUrl();
  if (!secret || !base) return { ok: false, error: "Scheduled jobs aren't configured here." };
  try {
    await fetch(new URL(path, base), {
      headers: { authorization: `Bearer ${secret}`, [DISPATCH_HEADER]: "1" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return { ok: true };
  } catch (err) {
    // A timeout means the job started and is still working, which is expected.
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return { ok: true };
    return { ok: false, error: "Couldn't reach the job. Try again." };
  }
}

/** The dispatcher's pass: start every job that is due, and record it. */
export async function runDueScheduleOverrides(now: Date = new Date()): Promise<{ started: string[] }> {
  const started: string[] = [];
  const client = db();
  for (const row of (await loadScheduleOverrides()).values()) {
    if (row.job === DISPATCHER_PATH) continue;
    const due = dueNow(row, now);
    if (!due.run) continue;
    // Record first, so an overlapping pass can't start the same job twice.
    if (due.oneOff && !splitCron(row.cron).length) {
      await client.from("cron_schedule_overrides").delete().eq("job", row.job);
    } else {
      await client
        .from("cron_schedule_overrides")
        .update({ last_dispatch_at: now.toISOString(), ...(due.oneOff ? { next_run_at: null } : {}) })
        .eq("job", row.job);
    }
    const res = await triggerJob(row.job);
    if (res.ok) started.push(row.job);
  }
  return { started };
}
