/**
 * Read side for Admin, System, Scheduled jobs beyond the latest result:
 * the recent runs of one job (loaded when its row is opened), the steps an
 * orchestration run reached, and the code updates queue (Code updates tab).
 * Every read is best effort: a missing table gives an empty list.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** A run still "running" past the longest function limit (300s) was killed. */
export const KILLED_AFTER_MS = 6 * 60_000;

export type RunOutcome = "ok" | "error" | "skipped" | "running" | "timed_out";

export type HistoryRun = {
  started_at: string;
  duration_ms: number | null;
  outcome: RunOutcome;
  http_status: number | null;
  detail: string | null;
  /** Orchestration only: the last step the run reached. */
  step: string | null;
};

export const ORCHESTRATION_PATH = "/api/cron/run-orchestration";

const STEP_LABELS: Record<string, string> = {
  notification_orchestration: "Notifications",
  scheduled_digest_pass: "Digests",
  match_notifications: "Match notices",
  investor_outreach_send: "Outreach sends",
};

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** "started" / "step:running" / "step:done" into words for the run history. */
export function describePhase(phase: string | null | undefined, finished: boolean): string | null {
  if (!phase) return null;
  if (phase === "started") return finished ? "Started" : "Started, no step finished";
  const [step, state] = phase.split(":");
  if (!step) return null;
  if (state === "running") return finished ? `Ran ${stepLabel(step)}` : `Stopped in ${stepLabel(step)}`;
  if (state === "done") return finished ? `Finished after ${stepLabel(step)}` : `Stopped after ${stepLabel(step)}`;
  return stepLabel(step);
}

function outcomeOf(status: string, startedAt: string, now: number): RunOutcome {
  if (status === "running" || status === "started") {
    return now - new Date(startedAt).getTime() > KILLED_AFTER_MS ? "timed_out" : "running";
  }
  if (status === "ok" || status === "completed" || status === "success") return "ok";
  if (status === "skipped") return "skipped";
  return "error";
}

/** The last runs of one job, newest first. Orchestration reads its own run table, which records steps. */
export async function loadJobRunHistory(path: string, limit = 10): Promise<HistoryRun[]> {
  const now = Date.now();
  try {
    if (path === ORCHESTRATION_PATH) {
      const { data } = await db()
        .from("orchestration_runs")
        .select("started_at, completed_at, duration_ms, status, metadata")
        .order("started_at", { ascending: false })
        .limit(limit);
      return ((data ?? []) as Array<{ started_at: string; completed_at: string | null; duration_ms: number | null; status: string; metadata: { phase?: string } | null }>).map((r) => {
        const outcome = r.completed_at && r.status === "running" ? "error" : outcomeOf(r.status, r.started_at, now);
        return {
          started_at: r.started_at,
          duration_ms: r.duration_ms,
          outcome,
          http_status: null,
          detail: null,
          step: describePhase(r.metadata?.phase, outcome === "ok"),
        };
      });
    }
    const { data } = await db()
      .from("cron_runs")
      .select("started_at, duration_ms, status, http_status, detail")
      .eq("job", path)
      .order("started_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as Array<{ started_at: string; duration_ms: number | null; status: string; http_status: number | null; detail: string | null }>).map((r) => ({
      started_at: r.started_at,
      duration_ms: r.duration_ms,
      outcome: outcomeOf(r.status, r.started_at, now),
      http_status: r.http_status,
      detail: r.detail,
      step: null,
    }));
  } catch {
    return [];
  }
}

export type CodeUpdate = {
  id: number;
  created_at: string;
  title: string;
  status: string;
  applied_sha: string | null;
  applied_at: string | null;
  result: string | null;
};

/** The code updates queue, newest first, without the patch bodies. */
export async function loadCodeUpdates(limit = 200): Promise<CodeUpdate[]> {
  try {
    const { data } = await db()
      .from("dev_patch_queue")
      .select("id, created_at, title, status, applied_sha, applied_at, result")
      .order("id", { ascending: false })
      .limit(limit);
    return (data ?? []) as CodeUpdate[];
  } catch {
    return [];
  }
}
