import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, listStaffProfileIds } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { KILLED_AFTER_MS } from "@/lib/cron/run-history";
import { cronJobName } from "@/lib/cron/jobs";
import {
  alertText,
  classifyState,
  decide,
  normalizeSettings,
  type HealthSettings,
  type HealthState,
  type OpenIncident,
  type Reading,
} from "@/lib/db-health/evaluate";

export const DB_HEALTH_SETTINGS_KEY = "db_health_settings";
/** Where alerts send the reader. */
export const DB_HEALTH_LINK = "/admin/system-health/database";
const SAMPLE_RETENTION_DAYS = 30;

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function loadHealthSettings(): Promise<HealthSettings> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", DB_HEALTH_SETTINGS_KEY).maybeSingle();
    return normalizeSettings((data as { value?: unknown } | null)?.value);
  } catch {
    return normalizeSettings(null);
  }
}

/** Time a simple query through the API, the same path the app uses. */
async function probe(client: SupabaseClient): Promise<{ responseMs: number | null; error: string | null }> {
  const started = Date.now();
  try {
    const { error } = await client.from("platform_settings").select("key").limit(1);
    if (error) return { responseMs: null, error: error.message.slice(0, 200) };
    return { responseMs: Date.now() - started, error: null };
  } catch (err) {
    return { responseMs: null, error: (err instanceof Error ? err.message : "probe failed").slice(0, 200) };
  }
}

async function snapshot(client: SupabaseClient) {
  try {
    const { data, error } = await client.rpc("db_health_snapshot");
    if (error || !data || typeof data !== "object") return { connections: null, longestS: null, longestText: null };
    const d = data as { active_connections?: number | null; longest_query_s?: number | string | null; longest_query_text?: string | null };
    const longest = d.longest_query_s === null || d.longest_query_s === undefined ? null : Number(d.longest_query_s);
    return {
      connections: typeof d.active_connections === "number" ? d.active_connections : null,
      longestS: longest !== null && Number.isFinite(longest) ? longest : null,
      longestText: d.longest_query_text ?? null,
    };
  } catch {
    return { connections: null, longestS: null, longestText: null };
  }
}

/**
 * Scheduled jobs found, at this check, to have started and never finished.
 * Uses the same rule as Scheduled jobs: still "running" after KILLED_AFTER_MS
 * means the function was killed. Each job is found once, in the check whose
 * window its start time falls in.
 */
async function newCronTimeouts(client: SupabaseClient, now: number, prevAt: number | null): Promise<string[]> {
  try {
    const windowStart = (prevAt ?? now - 10 * 60_000) - KILLED_AFTER_MS;
    const windowEnd = now - KILLED_AFTER_MS;
    const { data } = await client
      .from("cron_runs")
      .select("job")
      .eq("status", "running")
      .gt("started_at", new Date(windowStart).toISOString())
      .lte("started_at", new Date(windowEnd).toISOString())
      .limit(50);
    return ((data ?? []) as { job: string }[]).map((r) => r.job);
  } catch {
    return [];
  }
}

async function notifyStaff(opts: { incidentId: number; settings: HealthSettings; title: string; message: string; severity: "high" | "critical" }) {
  const { incidentId, settings, title, message, severity } = opts;
  const client = db();
  if (settings.notifyBell) {
    const ids = await listStaffProfileIds();
    await Promise.all(
      ids.map((recipientUserId) =>
        createNotification({
          recipientUserId,
          type: "db_health_alert",
          title: title.slice(0, 200),
          message,
          entityType: "db_health_incident",
          severity,
          deepLink: DB_HEALTH_LINK,
          dedupeKey: `db_health:incident:${incidentId}`,
        }),
      ),
    );
  }
  if (settings.notifyEmail) {
    try {
      const { data } = await client.from("profiles").select("email").in("role", ["admin", "analyst"]);
      const to = [...new Set(((data ?? []) as { email: string | null }[]).map((r) => r.email).filter((e): e is string => !!e && e.includes("@")))];
      if (to.length) {
        const safe = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
        await sendEmail({ to, subject: title, text: message, html: `<p>${safe(message)}</p>` });
      }
    } catch {
      /* the bell notice is the record; a failed email must not fail the check */
    }
  }
}

export type HealthCheckResult = {
  state: HealthState;
  responseMs: number | null;
  longestQueryS: number | null;
  newCronTimeouts: number;
  incident: "opened" | "updated" | "closed" | "none";
};

/** One check: take a reading, store it, then open, update or close an incident. */
export async function runDbHealthCheck(): Promise<HealthCheckResult> {
  const client = db();
  const settings = await loadHealthSettings();
  const now = Date.now();

  const [pr, snap, prev] = await Promise.all([
    probe(client),
    snapshot(client),
    client.from("db_health_samples").select("taken_at").order("taken_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const prevAt = (prev.data as { taken_at?: string } | null)?.taken_at ? new Date((prev.data as { taken_at: string }).taken_at).getTime() : null;
  const timedOutJobs = await newCronTimeouts(client, now, prevAt);

  const reading: Reading = {
    responseMs: pr.responseMs,
    probeFailed: pr.responseMs === null,
    longestQueryS: snap.longestS,
    newCronTimeouts: timedOutJobs.length,
  };
  const state = classifyState(reading, settings);

  await client.from("db_health_samples").insert({
    response_ms: reading.responseMs,
    probe_error: pr.error,
    active_connections: snap.connections,
    longest_query_s: reading.longestQueryS,
    longest_query_text: snap.longestText,
    cron_timeouts: reading.newCronTimeouts,
    state,
  });

  const { data: recent } = await client
    .from("db_health_samples")
    .select("state")
    .order("taken_at", { ascending: false })
    .limit(Math.max(settings.consecutive, 1));
  const recentStates = ((recent ?? []) as { state: HealthState }[]).map((r) => r.state);

  const { data: openRow } = await client
    .from("db_health_incidents")
    .select("id, peak_state, peak_response_ms, peak_query_s, cron_timeouts")
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();
  const o = openRow as { id: number; peak_state: "warn" | "overload"; peak_response_ms: number | null; peak_query_s: number | string | null; cron_timeouts: number } | null;
  const open: OpenIncident | null = o
    ? { id: o.id, peakState: o.peak_state, peakResponseMs: o.peak_response_ms, peakQueryS: o.peak_query_s === null ? null : Number(o.peak_query_s), cronTimeouts: o.cron_timeouts }
    : null;

  const decision = decide({ reading, state, recentStates, open, settings });
  let incident: HealthCheckResult["incident"] = "none";

  if (decision.action === "open") {
    const { data: created } = await client
      .from("db_health_incidents")
      .insert({
        peak_state: decision.peakState,
        cause: decision.cause,
        peak_response_ms: reading.responseMs,
        peak_query_s: reading.longestQueryS,
        cron_timeouts: reading.newCronTimeouts,
      })
      .select("id")
      .single();
    const id = (created as { id?: number } | null)?.id;
    if (id) {
      incident = "opened";
      const text = alertText({
        cause: decision.cause,
        peakState: decision.peakState,
        reading,
        timedOutJobs: [...new Set(timedOutJobs.map((p) => cronJobName(p)))].slice(0, 4),
      });
      await notifyStaff({ incidentId: id, settings, ...text, severity: decision.peakState === "overload" ? "critical" : "high" });
      await client.from("db_health_incidents").update({ notified_at: new Date().toISOString() }).eq("id", id);
    }
  } else if (decision.action === "update" && open) {
    incident = "updated";
    await client
      .from("db_health_incidents")
      .update({
        peak_state: decision.peakState,
        peak_response_ms: decision.peakResponseMs,
        peak_query_s: decision.peakQueryS,
        cron_timeouts: decision.cronTimeouts,
      })
      .eq("id", open.id);
  } else if (decision.action === "close" && open) {
    incident = "closed";
    await client.from("db_health_incidents").update({ ended_at: new Date().toISOString() }).eq("id", open.id);
  }

  // Keep 30 days of readings. Incidents are kept.
  await client
    .from("db_health_samples")
    .delete()
    .lt("taken_at", new Date(now - SAMPLE_RETENTION_DAYS * 86_400_000).toISOString());

  return { state, responseMs: reading.responseMs, longestQueryS: reading.longestQueryS, newCronTimeouts: reading.newCronTimeouts, incident };
}
